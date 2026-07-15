import { describe, expect, it } from 'vitest';
import { evaluateBenchmark, temporalIoU, type BenchmarkDataset, type BenchmarkPredictions } from './benchmark.js';

const dataset: BenchmarkDataset = {
  schemaVersion: 1,
  name: 'pt-br-golden-v1',
  samples: [
    { id: 'video-1', durationSec: 120, referenceClips: [{ start: 10, end: 40 }, { start: 70, end: 100 }] },
    { id: 'video-2', durationSec: 90, referenceClips: [{ start: 20, end: 50 }] },
  ],
};

describe('clip benchmark', () => {
  it('calcula IoU temporal', () => {
    expect(temporalIoU({ start: 10, end: 30 }, { start: 20, end: 40 })).toBeCloseTo(1 / 3);
    expect(temporalIoU({ start: 0, end: 5 }, { start: 10, end: 15 })).toBe(0);
  });

  it('produz nota perfeita para predições idênticas', () => {
    const predictions: BenchmarkPredictions = {
      schemaVersion: 1,
      system: 'perfect',
      samples: dataset.samples.map((sample) => ({ id: sample.id, predictedClips: sample.referenceClips })),
    };
    const report = evaluateBenchmark(dataset, predictions);
    expect(report.score).toBe(100);
    expect(report.thresholds[1]).toMatchObject({ precision: 1, recall: 1, f1: 1 });
    expect(report.boundaryMaeSec).toBe(0);
  });

  it('penaliza duplicatas, falsos positivos e amostras ausentes', () => {
    const predictions: BenchmarkPredictions = {
      schemaVersion: 1,
      system: 'candidate',
      samples: [{ id: 'video-1', predictedClips: [{ start: 10, end: 40 }, { start: 10, end: 40 }, { start: 0, end: 5 }] }],
    };
    const report = evaluateBenchmark(dataset, predictions);
    expect(report.coverage).toBe(0.5);
    expect(report.missingSampleIds).toEqual(['video-2']);
    expect(report.thresholds[1]).toMatchObject({ truePositives: 1, falsePositives: 2, falseNegatives: 2 });
    expect(report.score).toBeLessThan(50);
  });

  it('rejeita intervalos fora do vídeo', () => {
    const predictions: BenchmarkPredictions = {
      schemaVersion: 1,
      system: 'invalid',
      samples: [{ id: 'video-2', predictedClips: [{ start: 80, end: 100 }] }],
    };
    expect(() => evaluateBenchmark(dataset, predictions)).toThrow(/intervalo inválido/);
  });

  it('usa matching máximo quando há candidatos concorrendo pela mesma referência', () => {
    const ambiguousDataset: BenchmarkDataset = {
      schemaVersion: 1,
      name: 'ambiguous',
      samples: [{ id: 'video', durationSec: 100, referenceClips: [{ start: 0, end: 30 }, { start: 20, end: 50 }] }],
    };
    const predictions: BenchmarkPredictions = {
      schemaVersion: 1,
      system: 'candidate',
      samples: [{ id: 'video', predictedClips: [{ start: 5, end: 40 }, { start: 0, end: 25 }] }],
    };
    const report = evaluateBenchmark(ambiguousDataset, predictions, [0.3]);
    expect(report.thresholds[0].truePositives).toBe(2);
  });
});
