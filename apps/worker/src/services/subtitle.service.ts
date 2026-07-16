import { Injectable } from '@nestjs/common';
import type { CaptionTheme } from '@prisma/client';
import type { TranscriptSegment } from '@viralforge/clip-analyzer';
import type { WordSegment } from '@viralforge/render-engine';
import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cleanText } from '@viralforge/shared';
import { mkdir } from 'node:fs/promises';

const ASS_HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

const ASS_EVENTS_HEADER = `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const THEME_STYLES: Record<CaptionTheme, string> = {
  CLEAN_FOOTER:
    'Style: Caption,Arial,46,&H00FFFFFF,&H000000FF,&H00111111,&H99000000,-1,0,0,0,100,100,0,0,1,5,0,2,90,90,150,1',
  BOLD_FOOTER:
    'Style: Caption,Arial,54,&H0000FFFF,&H000000FF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,1,7,1,2,70,70,165,1',
  CREATOR_BOX:
    'Style: Caption,Arial,48,&H00FFFFFF,&H000000FF,&H00141414,&HCC141414,-1,0,0,0,100,100,0,0,3,4,0,2,90,90,155,1',
  MINIMAL:
    'Style: Caption,Arial,40,&H00FFFFFF,&H000000FF,&H00333333,&H66000000,0,0,0,0,100,100,0,0,1,3,0,2,120,120,145,1',
  BOLD_CREATOR:
    'Style: Caption,Arial,58,&H00FFFFFF,&H000000FF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,1,8,1,2,70,70,160,1',
  CLEAN_EDITORIAL:
    'Style: Caption,Arial,46,&H00FFFFFF,&H000000FF,&H00111111,&H99000000,-1,0,0,0,100,100,0,0,3,3,0,2,100,100,150,1',
  NEON_TECH:
    'Style: Caption,Arial,50,&H0000FFE0,&H000000FF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,5,1,2,80,80,220,1',
  KARAOKE_PRO:
    'Style: Caption,Arial,50,&H00FFFFFF,&H000000FF,&H00202020,&H99000000,-1,0,0,0,100,100,0,0,3,3,0,2,90,90,150,1',
  PODCAST_PRO:
    'Style: Caption,Arial,46,&H00FFFFFF,&H000000FF,&H00101010,&HAA000000,-1,0,0,0,100,100,0,0,3,3,0,2,90,90,145,1',
  STORY_IMPACT:
    'Style: Caption,Arial,62,&H00FFFFFF,&H000000FF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,8,1,5,60,60,0,1',
};

const THEME_LINE_WIDTH: Record<CaptionTheme, number> = {
  CLEAN_FOOTER: 28,
  BOLD_FOOTER: 24,
  CREATOR_BOX: 26,
  MINIMAL: 34,
  BOLD_CREATOR: 20,
  CLEAN_EDITORIAL: 30,
  NEON_TECH: 22,
  KARAOKE_PRO: 26,
  PODCAST_PRO: 28,
  STORY_IMPACT: 16,
};

// Active-word highlight colour per theme (ASS &HBBGGRR&), chosen to contrast
// with the base text colour so the spoken word visibly pops.
const THEME_HIGHLIGHT: Record<CaptionTheme, string> = {
  CLEAN_FOOTER: '&H00FFFF&', // yellow on white
  BOLD_FOOTER: '&H00FF00&', // green on yellow
  CREATOR_BOX: '&H00FFFF&',
  MINIMAL: '&H00FFFF&',
  BOLD_CREATOR: '&H00E5FF&',
  CLEAN_EDITORIAL: '&H00FFFF&',
  NEON_TECH: '&HFF00C8&', // magenta on neon-cyan
  KARAOKE_PRO: '&H00FFFF&',
  PODCAST_PRO: '&H00D7FF&',
  STORY_IMPACT: '&H00FFFF&',
};

// Words past this silent gap (seconds) start a new caption page instead of
// being held on screen across a pause.
const PAGE_GAP_SECONDS = 1.0;
const MAX_WORDS_PER_PAGE = 7;
const MIN_WORD_DURATION = 0.12;

type RelativeWord = { word: string; start: number; end: number };

@Injectable()
export class SubtitleService {
  async writeSubtitles(
    segments: TranscriptSegment[],
    start: number,
    end: number,
    srtPath: string,
    vttPath: string,
    assPath: string,
    theme: CaptionTheme,
    words?: WordSegment[],
  ) {
    const clipSegments = segments
      .filter((segment) => segment.end > start && segment.start < end)
      .map((segment) => ({
        ...segment,
        start: Math.max(0, segment.start - start),
        end: Math.max(0.5, Math.min(end, segment.end) - start),
        text: this.wrapText(this.cleanText(segment.text), THEME_LINE_WIDTH[theme]),
      }));

    const relativeWords = this.clipWords(words, start, end);
    const ass =
      relativeWords.length >= 2
        ? this.toAssKaraoke(relativeWords, theme)
        : this.toAss(clipSegments, theme);

    await mkdir(dirname(srtPath), { recursive: true });
    await Promise.all([
      writeFile(srtPath, this.toSrt(clipSegments), 'utf8'),
      writeFile(vttPath, this.toVtt(clipSegments), 'utf8'),
      writeFile(assPath, ass, 'utf8'),
    ]);
  }

  private clipWords(
    words: WordSegment[] | undefined,
    start: number,
    end: number,
  ): RelativeWord[] {
    if (!words?.length) return [];
    return words
      .filter(
        (word) =>
          Number.isFinite(word.start) &&
          Number.isFinite(word.end) &&
          word.end > start &&
          word.start < end &&
          this.cleanText(word.word).trim().length > 0,
      )
      .map((word) => ({
        word: this.cleanText(word.word).trim(),
        start: Math.max(0, word.start - start),
        end: Math.min(end, word.end) - start,
      }))
      .filter((word) => word.end > word.start)
      .sort((a, b) => a.start - b.start);
  }

  /**
   * Build word-by-word "karaoke" captions: each spoken word is highlighted on
   * its own timing while the rest of the caption page stays visible. This is the
   * look used by viral short-form editors and is far more engaging than showing
   * a whole sentence at once.
   */
  private toAssKaraoke(words: RelativeWord[], theme: CaptionTheme): string {
    const maxChars = THEME_LINE_WIDTH[theme];
    const highlight = THEME_HIGHLIGHT[theme];
    const pages = this.paginateWords(words, maxChars);
    const events: string[] = [];

    for (const page of pages) {
      const lines = this.layoutLines(
        page.map((word) => word.word),
        maxChars,
      );
      for (let i = 0; i < page.length; i += 1) {
        const wordStart = page[i].start;
        // Hold the highlight until the next word begins so pauses do not flicker.
        const wordEnd =
          i + 1 < page.length
            ? Math.max(page[i + 1].start, wordStart + MIN_WORD_DURATION)
            : Math.max(page[i].end, wordStart + MIN_WORD_DURATION);
        const text = this.renderHighlightedLines(
          lines,
          page.map((word) => word.word),
          i,
          highlight,
        );
        events.push(
          `Dialogue: 0,${this.formatAssTime(wordStart)},${this.formatAssTime(wordEnd)},Caption,,0,0,0,,${text}`,
        );
      }
    }

    return `${ASS_HEADER}${THEME_STYLES[theme]}${ASS_EVENTS_HEADER}${events.join('\n')}\n`;
  }

  private paginateWords(
    words: RelativeWord[],
    maxChars: number,
  ): RelativeWord[][] {
    const pageBudget = maxChars * 2; // up to two lines per page
    const pages: RelativeWord[][] = [];
    let current: RelativeWord[] = [];
    let currentChars = 0;

    for (const word of words) {
      const prev = current.at(-1);
      const gap = prev ? word.start - prev.end : 0;
      const nextChars = currentChars + word.word.length + (current.length ? 1 : 0);
      const shouldBreak =
        current.length > 0 &&
        (nextChars > pageBudget ||
          current.length >= MAX_WORDS_PER_PAGE ||
          gap > PAGE_GAP_SECONDS);

      if (shouldBreak) {
        pages.push(current);
        current = [];
        currentChars = 0;
      }
      current.push(word);
      currentChars += word.word.length + (current.length > 1 ? 1 : 0);
    }
    if (current.length) pages.push(current);
    return pages;
  }

  /** Greedily split words into at most two lines of ~maxChars; returns word indices per line. */
  private layoutLines(words: string[], maxChars: number): number[][] {
    const lines: number[][] = [];
    let line: number[] = [];
    let lineLen = 0;
    for (let i = 0; i < words.length; i += 1) {
      const add = words[i].length + (line.length ? 1 : 0);
      if (line.length && lineLen + add > maxChars && lines.length < 1) {
        lines.push(line);
        line = [];
        lineLen = 0;
      }
      line.push(i);
      lineLen += words[i].length + (line.length > 1 ? 1 : 0);
    }
    if (line.length) lines.push(line);
    return lines;
  }

  private renderHighlightedLines(
    lines: number[][],
    pageWords: string[],
    activeIndex: number,
    highlight: string,
  ): string {
    return lines
      .map((line) =>
        line
          .map((wordIndex) => {
            const escaped = this.escapeAssWord(pageWords[wordIndex] ?? '');
            if (wordIndex !== activeIndex) return escaped;
            // Pop the active word: highlight colour + slight scale-up, then reset.
            return `{\\c${highlight}\\fscx112\\fscy112}${escaped}{\\r}`;
          })
          .join(' '),
      )
      .join('\\N');
  }

  private toSrt(segments: TranscriptSegment[]): string {
    return segments
      .map((segment, index) => {
        return `${index + 1}\n${this.formatSrtTime(segment.start)} --> ${this.formatSrtTime(segment.end)}\n${segment.text}\n`;
      })
      .join('\n');
  }

  private toVtt(segments: TranscriptSegment[]): string {
    return `WEBVTT\n\n${segments
      .map((segment) => `${this.formatVttTime(segment.start)} --> ${this.formatVttTime(segment.end)}\n${segment.text}\n`)
      .join('\n')}`;
  }

  private toAss(segments: TranscriptSegment[], theme: CaptionTheme): string {
    const events = segments
      .map((segment) => {
        const text = this.escapeAssText(segment.text);
        return `Dialogue: 0,${this.formatAssTime(segment.start)},${this.formatAssTime(segment.end)},Caption,,0,0,0,,${text}`;
      })
      .join('\n');

    return `${ASS_HEADER}${THEME_STYLES[theme]}${ASS_EVENTS_HEADER}${events}\n`;
  }

  private wrapText(text: string, maxChars: number): string {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const weakLineEnd = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'e', 'ou', 'que']);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      if (`${current} ${word}`.trim().length > maxChars && current) {
        const currentWords = current.split(' ');
        if (weakLineEnd.has(currentWords.at(-1)?.toLowerCase() ?? '') && currentWords.length > 1) {
          const carried = currentWords.pop()!;
          lines.push(currentWords.join(' '));
          current = `${carried} ${word}`;
        } else {
          lines.push(current);
          current = word;
        }
      } else {
        current = `${current} ${word}`.trim();
      }

      if (lines.length === 2) {
        break;
      }
    }

    if (current && lines.length < 2) {
      lines.push(current);
    }

    return lines.join('\n');
  }

  private cleanText(text: string): string {
    return cleanText(text);
  }

  private escapeAssText(text: string): string {
    return text
      .replace(/[{}]/g, '')
      .replace(/\n/g, '\\N')
      // Sem escape de vírgula: Text é o ÚLTIMO campo do Dialogue:, então a
      // vírgula é literal. Escapar imprimia uma barra invertida na legenda
      // ("ola\, mundo"), porque o libass não trata \, como override.
      .trim();
  }

  private escapeAssWord(text: string): string {
    return text.replace(/[{}]/g, '').replace(/\\/g, '').trim();
  }

  private formatSrtTime(seconds: number): string {
    return this.formatTime(seconds, ',');
  }

  private formatVttTime(seconds: number): string {
    return this.formatTime(seconds, '.');
  }

  private formatAssTime(seconds: number): string {
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const cs = Math.floor((safe % 1) * 100);
    const total = Math.floor(safe);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${hh}:${this.pad(mm)}:${this.pad(ss)}.${String(cs).padStart(2, '0')}`;
  }

  private formatTime(seconds: number, separator: string): string {
    const ms = Math.round((seconds % 1) * 1000);
    const total = Math.floor(seconds);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${this.pad(hh)}:${this.pad(mm)}:${this.pad(ss)}${separator}${String(ms).padStart(3, '0')}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
