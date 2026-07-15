export interface BenchmarkClip {
  start: number;
  end: number;
  relevance?: number;
}

export interface BenchmarkSample {
  id: string;
  durationSec: number;
  referenceClips: BenchmarkClip[];
}

export interface PredictionSample {
  id: string;
  predictedClips: BenchmarkClip[];
}

export interface BenchmarkDataset {
  schemaVersion: 1;
  name: string;
  samples: BenchmarkSample[];
}

export interface BenchmarkPredictions {
  schemaVersion: 1;
  system: string;
  generatedAt?: string;
  samples: PredictionSample[];
}

export interface ThresholdMetrics {
  threshold: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkReport {
  dataset: string;
  system: string;
  sampleCount: number;
  referenceClipCount: number;
  predictedClipCount: number;
  coverage: number;
  thresholds: ThresholdMetrics[];
  meanBestIoU: number;
  boundaryMaeSec: number | null;
  durationMaeSec: number | null;
  score: number;
  missingSampleIds: string[];
}

interface Match {
  predictedIndex: number;
  referenceIndex: number;
  iou: number;
}

const DEFAULT_THRESHOLDS = [0.3, 0.5, 0.7];

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function validateClip(clip: BenchmarkClip, durationSec: number, label: string): void {
  if (!Number.isFinite(clip.start) || !Number.isFinite(clip.end)) {
    throw new Error(`${label}: start e end precisam ser números finitos`);
  }
  if (clip.start < 0 || clip.end <= clip.start || clip.end > durationSec + 0.01) {
    throw new Error(`${label}: intervalo inválido ${clip.start}-${clip.end} para vídeo de ${durationSec}s`);
  }
  if (clip.relevance !== undefined && (!Number.isFinite(clip.relevance) || clip.relevance < 1 || clip.relevance > 5)) {
    throw new Error(`${label}: relevance precisa estar entre 1 e 5`);
  }
}

export function validateBenchmarkInput(dataset: BenchmarkDataset, predictions: BenchmarkPredictions): void {
  if (dataset.schemaVersion !== 1 || predictions.schemaVersion !== 1) {
    throw new Error('schemaVersion não suportada; use a versão 1');
  }
  if (!dataset.name?.trim() || !predictions.system?.trim()) {
    throw new Error('Dataset precisa de name e predictions precisa de system');
  }

  const datasetIds = new Set<string>();
  for (const sample of dataset.samples) {
    if (!sample.id?.trim() || datasetIds.has(sample.id)) throw new Error(`ID de amostra inválido ou duplicado: ${sample.id}`);
    if (!Number.isFinite(sample.durationSec) || sample.durationSec <= 0) throw new Error(`${sample.id}: durationSec inválido`);
    datasetIds.add(sample.id);
    sample.referenceClips.forEach((clip, index) => validateClip(clip, sample.durationSec, `${sample.id}.referenceClips[${index}]`));
  }

  const predictionIds = new Set<string>();
  for (const sample of predictions.samples) {
    if (!sample.id?.trim() || predictionIds.has(sample.id)) throw new Error(`ID de predição inválido ou duplicado: ${sample.id}`);
    predictionIds.add(sample.id);
    const reference = dataset.samples.find((item) => item.id === sample.id);
    if (!reference) throw new Error(`Predição aponta para amostra inexistente: ${sample.id}`);
    sample.predictedClips.forEach((clip, index) => validateClip(clip, reference.durationSec, `${sample.id}.predictedClips[${index}]`));
  }
}

export function temporalIoU(a: BenchmarkClip, b: BenchmarkClip): number {
  const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union > 0 ? intersection / union : 0;
}

function matchClips(predicted: BenchmarkClip[], reference: BenchmarkClip[], threshold: number): Match[] {
  const adjacency = predicted.map((candidate, predictedIndex) => reference
    .map((expected, referenceIndex) => ({ predictedIndex, referenceIndex, iou: temporalIoU(candidate, expected) }))
    .filter((match) => match.iou >= threshold)
    .sort((a, b) => b.iou - a.iou));
  const referenceMatches = new Map<number, Match>();

  // Matching bipartido máximo: um greedy puro por IoU pode perder um match
  // válido quando um candidato flexível ocupa a única referência de outro.
  const assign = (predictedIndex: number, visitedReferences: Set<number>): boolean => {
    for (const candidate of adjacency[predictedIndex]) {
      if (visitedReferences.has(candidate.referenceIndex)) continue;
      visitedReferences.add(candidate.referenceIndex);
      const existing = referenceMatches.get(candidate.referenceIndex);
      if (!existing || assign(existing.predictedIndex, visitedReferences)) {
        referenceMatches.set(candidate.referenceIndex, candidate);
        return true;
      }
    }
    return false;
  };

  const predictionOrder = adjacency
    .map((edges, predictedIndex) => ({ predictedIndex, bestIoU: edges[0]?.iou ?? 0 }))
    .sort((a, b) => b.bestIoU - a.bestIoU);
  for (const item of predictionOrder) assign(item.predictedIndex, new Set());
  return [...referenceMatches.values()];
}

export function evaluateBenchmark(
  dataset: BenchmarkDataset,
  predictions: BenchmarkPredictions,
  thresholds = DEFAULT_THRESHOLDS,
): BenchmarkReport {
  validateBenchmarkInput(dataset, predictions);
  const predictionMap = new Map(predictions.samples.map((sample) => [sample.id, sample.predictedClips]));
  const missingSampleIds = dataset.samples.filter((sample) => !predictionMap.has(sample.id)).map((sample) => sample.id);
  const referenceClipCount = dataset.samples.reduce((sum, sample) => sum + sample.referenceClips.length, 0);
  const predictedClipCount = dataset.samples.reduce((sum, sample) => sum + (predictionMap.get(sample.id)?.length ?? 0), 0);

  const thresholdMetrics = thresholds.map((threshold) => {
    let truePositives = 0;
    for (const sample of dataset.samples) {
      truePositives += matchClips(predictionMap.get(sample.id) ?? [], sample.referenceClips, threshold).length;
    }
    const falsePositives = predictedClipCount - truePositives;
    const falseNegatives = referenceClipCount - truePositives;
    const precision = safeRatio(truePositives, truePositives + falsePositives);
    const recall = safeRatio(truePositives, truePositives + falseNegatives);
    const f1 = safeRatio(2 * precision * recall, precision + recall);
    return {
      threshold: round(threshold, 2),
      truePositives,
      falsePositives,
      falseNegatives,
      precision: round(precision),
      recall: round(recall),
      f1: round(f1),
    };
  });

  const bestIoUs: number[] = [];
  const boundaryErrors: number[] = [];
  const durationErrors: number[] = [];
  for (const sample of dataset.samples) {
    const predicted = predictionMap.get(sample.id) ?? [];
    for (const candidate of predicted) {
      bestIoUs.push(sample.referenceClips.reduce((best, expected) => Math.max(best, temporalIoU(candidate, expected)), 0));
    }
    for (const match of matchClips(predicted, sample.referenceClips, 0.5)) {
      const candidate = predicted[match.predictedIndex];
      const expected = sample.referenceClips[match.referenceIndex];
      boundaryErrors.push(Math.abs(candidate.start - expected.start), Math.abs(candidate.end - expected.end));
      durationErrors.push(Math.abs((candidate.end - candidate.start) - (expected.end - expected.start)));
    }
  }

  const f1At50 = thresholdMetrics.find((item) => item.threshold === 0.5)?.f1 ?? 0;
  const f1At70 = thresholdMetrics.find((item) => item.threshold === 0.7)?.f1 ?? 0;
  const meanBestIoU = safeRatio(bestIoUs.reduce((sum, value) => sum + value, 0), bestIoUs.length);
  // Nota de 0–100: qualidade de recuperação é central, mas cortes bem alinhados
  // e consistentes recebem peso próprio. Isso evita otimizar apenas quantidade.
  const score = (f1At50 * 0.55 + f1At70 * 0.25 + meanBestIoU * 0.2) * 100;

  return {
    dataset: dataset.name,
    system: predictions.system,
    sampleCount: dataset.samples.length,
    referenceClipCount,
    predictedClipCount,
    coverage: round(safeRatio(dataset.samples.length - missingSampleIds.length, dataset.samples.length)),
    thresholds: thresholdMetrics,
    meanBestIoU: round(meanBestIoU),
    boundaryMaeSec: boundaryErrors.length ? round(safeRatio(boundaryErrors.reduce((sum, value) => sum + value, 0), boundaryErrors.length), 3) : null,
    durationMaeSec: durationErrors.length ? round(safeRatio(durationErrors.reduce((sum, value) => sum + value, 0), durationErrors.length), 3) : null,
    score: round(score, 2),
    missingSampleIds,
  };
}
