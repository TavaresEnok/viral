import type { TranscriptSegment, WordSegment } from './types.js';

export function cleanCaptionText(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;?/gi, '>')
    .replace(/&quot;?/gi, '"')
    .replace(/&#(?:0*39|x0*27);?/gi, "'")
    .replace(/&apos;?/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:^|\s)(?:pt|en|es)(?:-[a-z]{2})?\s*[:;>]+\s*/gi, ' ')
    .replace(/\b[a-z]{2}(?:-[a-z]{2})?\s*>\s*>/gi, ' ')
    .replace(/>{1,2}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wrapWords(words: string[], maxCharsPerLine: number, maxLines = 2): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  const weakLineEnd = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'e', 'ou', 'que']);

  for (const word of words) {
    const next = [...current, word].join(' ');
    if (next.length > maxCharsPerLine && current.length > 0) {
      if (weakLineEnd.has(current.at(-1)?.toLowerCase() ?? '') && current.length > 1) {
        const carried = current.pop()!;
        lines.push(current);
        current = [carried, word];
        if (lines.length === maxLines) break;
        continue;
      }
      lines.push(current);
      current = [word];
    } else {
      current.push(word);
    }

    if (lines.length === maxLines) break;
  }

  if (current.length && lines.length < maxLines) lines.push(current);
  return lines;
}

export function activeSegmentAt(segments: TranscriptSegment[], time: number): TranscriptSegment | null {
  return segments.find((segment) => time >= segment.start && time <= segment.end) ?? null;
}

export function activeWordsAt(words: WordSegment[], time: number, windowSeconds = 2.8): WordSegment[] {
  const currentIndex = words.findIndex((word) => time >= word.start && time <= word.end);
  if (currentIndex === -1) {
    return words.filter((word) => word.start <= time + windowSeconds && word.end >= time - 0.4).slice(0, 7);
  }
  return words.slice(Math.max(0, currentIndex - 3), currentIndex + 5);
}
