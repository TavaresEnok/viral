import { describe, it, expect } from 'vitest';

// Pure logic extracted from SmartCropService — no NestJS/Prisma required

const EMA_ALPHA = 0.25;

function applyEma(values: number[], alpha = EMA_ALPHA): number {
  if (!values.length) return 0.5;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return ema;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

type FacePoint = { x: number; y: number; w: number; h: number; time: number; confidence: number };

function smooth(faces: FacePoint[]) {
  if (!faces.length) return null;
  const cxValues = faces.map((f) => clamp(f.x + f.w / 2, 0, 1));
  const cyValues = faces.map((f) => clamp(f.y + f.h / 2, 0, 1));
  return { cx: applyEma(cxValues), cy: applyEma(cyValues), coverageRatio: 1 };
}

describe('SmartCropService.smooth', () => {
  it('returns null for empty face array', () => {
    expect(smooth([])).toBeNull();
  });

  it('returns center for a single centered face', () => {
    const result = smooth([{ x: 0.375, y: 0.375, w: 0.25, h: 0.25, time: 0, confidence: 0.9 }]);
    expect(result?.cx).toBeCloseTo(0.5);
    expect(result?.cy).toBeCloseTo(0.5);
  });

  it('EMA with alpha=0.25 biases toward early values', () => {
    const ema = applyEma([0.2, 0.2, 0.9]);
    expect(ema).toBeGreaterThan(0.2);
    expect(ema).toBeLessThan(0.5);
  });

  it('clamps face center to [0,1] even when box exceeds frame', () => {
    const result = smooth([{ x: -0.1, y: 0, w: 0.2, h: 0.2, time: 0, confidence: 0.8 }]);
    expect(result?.cx).toBe(0);
  });

  it('converges on constant series', () => {
    const values = Array<number>(20).fill(0.7);
    expect(applyEma(values)).toBeCloseTo(0.7);
  });

  it('single-element EMA equals value', () => {
    expect(applyEma([0.3])).toBeCloseTo(0.3);
  });
});

describe('preview mode renderEnd clamping', () => {
  function renderEnd(start: number, end: number, previewSeconds?: number): number {
    return typeof previewSeconds === 'number'
      ? Math.min(end, start + previewSeconds)
      : end;
  }

  it('clamps end to start + previewSeconds', () => {
    expect(renderEnd(10, 55, 5)).toBe(15);
  });

  it('does not clamp when clip shorter than previewSeconds', () => {
    expect(renderEnd(10, 12, 5)).toBe(12);
  });

  it('returns full end when previewSeconds is undefined', () => {
    expect(renderEnd(10, 55)).toBe(55);
  });
});
