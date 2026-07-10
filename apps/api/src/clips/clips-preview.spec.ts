import { describe, it, expect } from 'vitest';

// Test the preview seconds clamping logic (pure function extracted from the service)
function clampPreviewSeconds(value: number | undefined): number | undefined {
  return value !== undefined ? Math.min(10, value) : undefined;
}

describe('preview seconds clamping', () => {
  it('clamps values over 10s to 10', () => {
    expect(clampPreviewSeconds(30)).toBe(10);
    expect(clampPreviewSeconds(11)).toBe(10);
  });

  it('passes through values under 10s', () => {
    expect(clampPreviewSeconds(5)).toBe(5);
    expect(clampPreviewSeconds(1)).toBe(1);
  });

  it('passes through undefined (full render)', () => {
    expect(clampPreviewSeconds(undefined)).toBeUndefined();
  });

  it('allows exactly 10s', () => {
    expect(clampPreviewSeconds(10)).toBe(10);
  });
});
