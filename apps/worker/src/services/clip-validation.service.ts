import { Injectable } from '@nestjs/common';
import {
  detectWeakEnding,
  getClipText,
  validateBoundaryAlignment,
  validateClipText,
  type ClipSuggestion,
  type TranscriptPayload,
  type TranscriptSegment,
} from '@viralforge/clip-analyzer';

@Injectable()
export class ClipValidationService {
  validate(
    clips: ClipSuggestion[],
    transcript: TranscriptPayload,
    videoDuration: number,
    minViralScore = 70,
    maxClips = 20,
  ): ClipSuggestion[] {
    const adjusted = clips
      .filter((clip) => clip.viral_score >= minViralScore)
      .map((clip) => this.checkBoundaryAlignment(clip, transcript.segments))
      .map((clip) => this.adjustToSentenceBoundaries(clip, transcript.segments))
      .map((clip) => this.adjustWeakOpening(clip, transcript.segments))
      .map((clip) => this.adjustWeakClosing(clip, transcript.segments))
      .map((clip) => this.validateActualText(clip, transcript.segments))
      .filter((clip) => clip.start >= 0 && clip.end <= videoDuration)
      .filter((clip) => clip.end > clip.start)
      .map((clip) => ({ ...clip, duration: Math.round(clip.end - clip.start) }))
      .filter((clip) => clip.duration >= 15 && clip.duration <= 90)
      .sort((a, b) => this.compositeScore(b) - this.compositeScore(a));

    const deduped: ClipSuggestion[] = [];
    for (const candidate of adjusted) {
      if (
        !deduped.some(
          (existing) =>
            this.overlapRatio(existing, candidate) > 0.65 ||
            this.textSimilarity(existing, candidate, transcript.segments) > 0.72,
        )
      ) {
        deduped.push(candidate);
      }
      if (deduped.length >= Math.max(1, maxClips)) {
        break;
      }
    }
    return deduped;
  }

  // Roda antes dos ajustes de fronteira: compara os timestamps crus do modelo
  // com o texto literal que ele declarou (hook/closing_real). Divergência
  // indica timestamps desalinhados — os ajustes posteriores movem start/end
  // de propósito e invalidariam a comparação.
  private checkBoundaryAlignment(clip: ClipSuggestion, segments: TranscriptSegment[]): ClipSuggestion {
    const boundary = validateBoundaryAlignment(
      clip.hook,
      clip.evaluation_notes?.closing_real,
      getClipText(clip.start, clip.end, segments),
    );
    if (boundary.startAligned && boundary.endAligned) {
      return clip;
    }

    return {
      ...clip,
      needs_review: true,
      risk_of_bad_cut: clip.risk_of_bad_cut === 'high' ? 'high' : 'medium',
      opening_strength: boundary.startAligned
        ? clip.opening_strength
        : Math.min(clip.opening_strength ?? clip.viral_score, 60),
      closing_strength: boundary.endAligned
        ? clip.closing_strength
        : Math.min(clip.closing_strength ?? clip.viral_score, 60),
      reason: `${clip.reason} Validação: texto literal declarado pela IA não encontrado na borda do intervalo; timestamps possivelmente desalinhados.`,
    };
  }

  private adjustToSentenceBoundaries(clip: ClipSuggestion, segments: TranscriptSegment[]): ClipSuggestion {
    const startSegment = segments.find((segment) => segment.end > clip.start);
    const endSegment = [...segments].reverse().find((segment) => segment.start < clip.end);

    const snappedStart = startSegment && Math.abs(startSegment.start - clip.start) <= 8 ? startSegment.start : clip.start;
    const snappedEnd = endSegment && Math.abs(endSegment.end - clip.end) <= 8 ? endSegment.end : clip.end;
    const start = snappedStart;
    const end = snappedEnd - start <= 90 ? snappedEnd : clip.end;
    return { ...clip, start, end, duration: Math.round(end - start) };
  }

  private adjustWeakOpening(clip: ClipSuggestion, segments: TranscriptSegment[]): ClipSuggestion {
    if (!this.hasWeakOpening(clip, segments)) {
      return clip;
    }

    const candidateStart = this.findPreviousGoodStart(clip.start, segments, Math.max(0, clip.start - 10));
    if (candidateStart !== null && clip.end - candidateStart <= 90) {
      return {
        ...clip,
        start: candidateStart,
        duration: Math.round(clip.end - candidateStart),
        opening_strength: Math.max(clip.opening_strength ?? clip.viral_score, 72),
        risk_of_bad_cut: clip.risk_of_bad_cut === 'high' ? 'medium' : clip.risk_of_bad_cut,
      };
    }

    return {
      ...clip,
      opening_strength: Math.min(clip.opening_strength ?? clip.viral_score, 48),
      risk_of_bad_cut: clip.risk_of_bad_cut ?? 'medium',
    };
  }

  private adjustWeakClosing(clip: ClipSuggestion, segments: TranscriptSegment[]): ClipSuggestion {
    if (!this.hasWeakEnding(clip, segments)) {
      return clip;
    }

    const extendedEnd = this.findNextGoodEnd(clip.end, segments, clip.end + 15);
    if (extendedEnd && extendedEnd - clip.start <= 90) {
      return {
        ...clip,
        end: extendedEnd,
        duration: Math.round(extendedEnd - clip.start),
        closing_strength: Math.max(clip.closing_strength ?? clip.viral_score, 72),
        closing_type: clip.closing_type === 'weak' ? 'conclusion' : clip.closing_type,
      };
    }

    return {
      ...clip,
      closing_strength: Math.min(clip.closing_strength ?? clip.viral_score, 45),
      closing_type: 'weak',
      risk_of_bad_cut: clip.risk_of_bad_cut ?? 'medium',
    };
  }

  private hasWeakOpening(clip: ClipSuggestion, segments: TranscriptSegment[]): boolean {
    if ((clip.opening_strength ?? 100) < 55) {
      return true;
    }

    const firstSegment = segments.find((segment) => segment.end > clip.start && segment.start < clip.end);
    if (!firstSegment) {
      return true;
    }

    const startsInsideSegment = clip.start - firstSegment.start > 1.2;
    const opening = firstSegment.text
      .trim()
      .toLowerCase()
      .replace(/^[,.;:!?")'”]+/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join(' ');

    const weakStarts = [
      'e ',
      'mas ',
      'então ',
      'entao ',
      'aí ',
      'ai ',
      'daí ',
      'dai ',
      'porque ',
      'por que ',
      'só que ',
      'so que ',
      'tipo ',
      'ou seja ',
      'isso ',
      'esse ',
      'essa ',
      'aquilo ',
      'né ',
      'ne ',
    ];

    return startsInsideSegment || weakStarts.some((weakStart) => opening.startsWith(weakStart));
  }

  private hasWeakEnding(clip: ClipSuggestion, segments: TranscriptSegment[]): boolean {
    if (clip.closing_type === 'weak' || (clip.closing_strength ?? 100) < 55) {
      return true;
    }

    const lastSegment = segments.filter((segment) => segment.start < clip.end && segment.end > clip.start).at(-1);
    if (!lastSegment) {
      return true;
    }

    const ending = lastSegment.text
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:)"'”]+$/g, '')
      .split(/\s+/)
      .slice(-3)
      .join(' ');

    return [
      'porque',
      'então',
      'entao',
      'mas',
      'só que',
      'so que',
      'ou seja',
      'tipo',
      'sabe',
      'tá',
      'ta',
      'né',
      'ne',
      'que',
      'de',
      'da',
      'do',
      'para',
      'pra',
      'por',
      'com',
      'em',
      'no',
      'na',
      'e',
      'ou',
    ].some((weakEnding) => ending.endsWith(weakEnding));
  }

  private findNextGoodEnd(currentEnd: number, segments: TranscriptSegment[], maxEnd: number): number | null {
    const candidates = segments.filter((segment) => segment.end > currentEnd && segment.end <= maxEnd);
    for (const segment of candidates) {
      const probe = { start: Math.max(0, currentEnd - 1), end: segment.end } as ClipSuggestion;
      if (!this.hasWeakEnding(probe, segments)) {
        return segment.end;
      }
    }
    return null;
  }

  private findPreviousGoodStart(currentStart: number, segments: TranscriptSegment[], minStart: number): number | null {
    const candidates = segments
      .filter((segment) => segment.start >= minStart && segment.start < currentStart)
      .sort((a, b) => b.start - a.start);

    for (const segment of candidates) {
      const probe = { ...({} as ClipSuggestion), start: segment.start, end: currentStart + 1 };
      if (!this.hasWeakOpening(probe, segments)) {
        return segment.start;
      }
    }

    const currentSegment = segments.find((segment) => segment.end > currentStart);
    return currentSegment?.start ?? null;
  }

  private overlapRatio(a: ClipSuggestion, b: ClipSuggestion): number {
    const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    const shorter = Math.min(a.end - a.start, b.end - b.start);
    return shorter > 0 ? overlap / shorter : 0;
  }

  private validateActualText(clip: ClipSuggestion, segments: TranscriptSegment[]): ClipSuggestion {
    const textValidation = validateClipText(clip.start, clip.end, clip.actual_text_in_clip, segments);
    const endingCheck = detectWeakEnding(textValidation.realText);
    const base = {
      ...clip,
      actual_text_in_clip: textValidation.realText.slice(0, 4000),
      text_similarity: textValidation.similarity,
      detected_weak_ending: endingCheck.isWeak,
      detected_last_words: endingCheck.lastWords,
      needs_review:
        clip.needs_review ||
        textValidation.needsReview ||
        endingCheck.isWeak ||
        clip.risk_of_bad_cut === 'high' ||
        (clip.closing_strength ?? clip.viral_score) < 75 ||
        (clip.opening_strength ?? clip.viral_score) < 75,
    };

    if (textValidation.similarity >= 0.65 && !endingCheck.isWeak) {
      return base;
    }

    return {
      ...base,
      risk_of_bad_cut: clip.risk_of_bad_cut === 'high' ? 'high' : 'medium',
      context_independence_score: Math.min(clip.context_independence_score ?? clip.viral_score, 65),
      reason:
        textValidation.similarity < 0.65
          ? `${clip.reason} Validação: texto declarado pela IA divergiu da transcrição no intervalo.`
          : `${clip.reason} Validação: final detectado como fraco ou pendente.`,
    };
  }

  private textSimilarity(a: ClipSuggestion, b: ClipSuggestion, segments: TranscriptSegment[]): number {
    const aWords = this.clipWords(a, segments);
    const bWords = this.clipWords(b, segments);
    if (!aWords.size || !bWords.size) return 0;

    let intersection = 0;
    for (const word of aWords) {
      if (bWords.has(word)) intersection += 1;
    }
    const union = new Set([...aWords, ...bWords]).size;
    return union ? intersection / union : 0;
  }

  private clipWords(clip: ClipSuggestion, segments: TranscriptSegment[]): Set<string> {
    const stopWords = new Set(['que', 'com', 'para', 'pra', 'uma', 'um', 'das', 'dos', 'por', 'não', 'nao', 'isso', 'esse', 'essa', 'aqui']);
    const text = segments
      .filter((segment) => segment.end > clip.start && segment.start < clip.end)
      .map((segment) => segment.text)
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');

    return new Set(
      text
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !stopWords.has(word)),
    );
  }

  private compositeScore(clip: ClipSuggestion): number {
    const opening = clip.opening_strength ?? clip.viral_score;
    const closing = clip.closing_strength ?? clip.viral_score;
    const context = clip.context_independence_score ?? clip.viral_score;
    const emotional = clip.emotional_density ?? clip.viral_score;
    const quotability = clip.quotability ?? clip.viral_score;
    const riskPenalty = clip.risk_of_bad_cut === 'high' ? 12 : clip.risk_of_bad_cut === 'medium' ? 5 : 0;
    return opening * 0.3 + closing * 0.3 + quotability * 0.2 + emotional * 0.1 + context * 0.1 - riskPenalty;
  }
}
