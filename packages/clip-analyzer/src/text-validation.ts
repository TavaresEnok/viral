import type { TranscriptSegment } from './types.js';

export interface ClipTextValidationResult {
  isValid: boolean;
  similarity: number;
  realText: string;
  reportedText: string;
  needsReview: boolean;
}

const WEAK_ENDINGS_PT = [
  'porque',
  'entao',
  'então',
  'mas',
  'so que',
  'só que',
  'tipo',
  'sabe',
  'ta',
  'tá',
  'ne',
  'né',
  'ou seja',
  'no caso',
  'e',
  'ou',
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
  'pelo',
  'pela',
  'um',
  'uma',
  'o',
  'a',
  'os',
  'as',
];

export function getClipText(clipStart: number, clipEnd: number, allSegments: TranscriptSegment[]): string {
  return allSegments
    .filter((segment) => segment.start < clipEnd && segment.end > clipStart)
    .map((segment) => segment.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateClipText(
  clipStart: number,
  clipEnd: number,
  reportedText: string | undefined,
  allSegments: TranscriptSegment[],
): ClipTextValidationResult {
  const realText = getClipText(clipStart, clipEnd, allSegments);
  const safeReportedText = reportedText?.trim() || '';
  const similarity = computeTextSimilarity(safeReportedText, realText);

  return {
    isValid: similarity >= 0.65,
    similarity,
    realText,
    reportedText: safeReportedText,
    needsReview: similarity < 0.8,
  };
}

export interface BoundaryAlignmentResult {
  startAligned: boolean;
  endAligned: boolean;
  startSimilarity: number | null;
  endSimilarity: number | null;
}

const BOUNDARY_MATCH_THRESHOLD = 0.5;

/**
 * Compara o texto literal que o modelo declarou para as bordas do corte
 * (hook = primeira frase, closingReal = últimas palavras) com o texto real
 * da transcrição no intervalo. Similaridade baixa indica que os timestamps
 * retornados não correspondem ao trecho que o modelo achou que cortava.
 * Retorna null na similaridade quando o campo não veio ou é curto demais
 * para discriminar (nesse caso a borda é considerada alinhada).
 */
export function validateBoundaryAlignment(
  claimedHook: string | undefined,
  claimedClosing: string | undefined,
  realText: string,
): BoundaryAlignmentResult {
  const realTokens = normalizeAndTokenize(realText);
  const startSimilarity = boundaryContainment(claimedHook, realTokens, 'start');
  const endSimilarity = boundaryContainment(claimedClosing, realTokens, 'end');

  return {
    startAligned: startSimilarity === null || startSimilarity >= BOUNDARY_MATCH_THRESHOLD,
    endAligned: endSimilarity === null || endSimilarity >= BOUNDARY_MATCH_THRESHOLD,
    startSimilarity,
    endSimilarity,
  };
}

function boundaryContainment(
  claimed: string | undefined,
  realTokens: string[],
  edge: 'start' | 'end',
): number | null {
  const claimedTokens = normalizeAndTokenize(claimed ?? '');
  if (claimedTokens.length < 2 || !realTokens.length) {
    return null;
  }

  const windowSize = Math.min(realTokens.length, claimedTokens.length + 6);
  const window = new Set(edge === 'start' ? realTokens.slice(0, windowSize) : realTokens.slice(-windowSize));
  let hits = 0;
  for (const token of claimedTokens) {
    if (window.has(token)) {
      hits += 1;
    }
  }
  return hits / claimedTokens.length;
}

export function detectWeakEnding(text: string): { isWeak: boolean; lastWords: string } {
  const tokens = normalizeAndTokenize(text.replace(/[.!?,;:]+$/g, ''));
  if (!tokens.length) {
    return { isWeak: false, lastWords: '' };
  }

  const lastWord = tokens.at(-1) ?? '';
  const lastTwo = tokens.slice(-2).join(' ');
  const isWeak = WEAK_ENDINGS_PT.includes(lastWord) || WEAK_ENDINGS_PT.includes(lastTwo);

  return {
    isWeak,
    lastWords: tokens.slice(-3).join(' '),
  };
}

export function computeTextSimilarity(a: string, b: string): number {
  const tokensA = normalizeAndTokenize(a);
  const tokensB = normalizeAndTokenize(b);

  if (!tokensA.length || !tokensB.length) {
    return 0;
  }

  const significantA = new Set(tokensA.filter((token) => token.length >= 4));
  const significantB = new Set(tokensB.filter((token) => token.length >= 4));

  if (!significantA.size || !significantB.size) {
    // Fall back to full token comparison if both texts consist only of short words
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let common = 0;
    for (const word of setA) {
      if (setB.has(word)) {
        common += 1;
      }
    }
    return common / Math.max(setA.size, setB.size);
  }

  let common = 0;
  for (const word of significantA) {
    if (significantB.has(word)) {
      common += 1;
    }
  }

  return common / Math.max(significantA.size, significantB.size);
}

function normalizeAndTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
