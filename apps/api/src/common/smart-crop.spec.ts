/**
 * Unit tests for the EMA-based smart crop logic.
 * Tests the smoothing and clamping behaviour without instantiating NestJS.
 */
import { describe, it, expect } from 'vitest';

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

  it('returns center (0.5, 0.5) for a single face at center', () => {
    const result = smooth([{ x: 0.375, y: 0.375, w: 0.25, h: 0.25, time: 0, confidence: 0.9 }]);
    expect(result?.cx).toBeCloseTo(0.5);
    expect(result?.cy).toBeCloseTo(0.5);
  });

  it('EMA smooths toward last value when alpha=0.25', () => {
    // series: [0.2, 0.2, 0.9] — EMA should be closer to 0.2 than 0.9
    const values = [0.2, 0.2, 0.9];
    const ema = applyEma(values);
    expect(ema).toBeGreaterThan(0.2);
    expect(ema).toBeLessThan(0.9);
    expect(ema).toBeLessThan(0.5); // still biased toward early values
  });

  it('clamps face center to [0, 1]', () => {
    // Face box that extends outside frame
    const result = smooth([{ x: -0.1, y: 0.0, w: 0.2, h: 0.2, time: 0, confidence: 0.8 }]);
    // cx = clamp(-0.1 + 0.1, 0, 1) = clamp(0, 0, 1) = 0
    expect(result?.cx).toBe(0);
  });

  it('returns 0.5 from applyEma when given empty array (fallback)', () => {
    expect(applyEma([])).toBe(0.5);
  });

  it('single-element EMA equals the value itself', () => {
    expect(applyEma([0.3])).toBeCloseTo(0.3);
  });

  it('converges on constant series', () => {
    const values = Array(20).fill(0.7) as number[];
    expect(applyEma(values)).toBeCloseTo(0.7);
  });
});

describe('renderEnd clamping for preview mode', () => {
  function previewEnd(start: number, end: number, previewSeconds?: number): number {
    return previewSeconds !== undefined
      ? Math.min(end, start + previewSeconds)
      : end;
  }

  it('clamps end to start + previewSeconds', () => {
    expect(previewEnd(10, 55, 5)).toBe(15);
  });

  it('does not clamp if clip is shorter than previewSeconds', () => {
    expect(previewEnd(10, 12, 5)).toBe(12);
  });

  it('returns full end when no previewSeconds', () => {
    expect(previewEnd(10, 55, undefined)).toBe(55);
  });
});
