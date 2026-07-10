import { describe, expect, it } from 'vitest';
import { computeClipTarget, CLIP_TARGET_FLOOR, CLIP_TARGET_CEIL } from './pipeline.types.js';

describe('computeClipTarget', () => {
  it('mantém piso de 5 em vídeos curtos (sem regressão)', () => {
    expect(computeClipTarget(60)).toBe(CLIP_TARGET_FLOOR); // 1 min
    expect(computeClipTarget(300)).toBe(CLIP_TARGET_FLOOR); // 5 min
    expect(computeClipTarget(600)).toBe(CLIP_TARGET_FLOOR); // 10 min
  });

  it('escala com a duração em vídeos médios/longos', () => {
    expect(computeClipTarget(1800)).toBe(9); // 30 min → round(8.57)
    expect(computeClipTarget(3600)).toBe(17); // 60 min → round(17.1)
  });

  it('não passa do teto de 20 em vídeos muito longos', () => {
    expect(computeClipTarget(5400)).toBe(CLIP_TARGET_CEIL); // 90 min
    expect(computeClipTarget(36000)).toBe(CLIP_TARGET_CEIL); // 10 h
  });

  it('limita pelo saldo de renders quando informado', () => {
    expect(computeClipTarget(3600, 3)).toBe(3); // byDuration 17, mas só 3 de saldo
    expect(computeClipTarget(3600, 50)).toBe(17); // saldo folgado → byDuration
  });

  it('ignora saldo zero/negativo e deixa o gate de quota tratar depois', () => {
    expect(computeClipTarget(3600, 0)).toBe(17);
    expect(computeClipTarget(3600, -5)).toBe(17);
  });

  it('lida com duração inválida (0/NaN) caindo no piso', () => {
    expect(computeClipTarget(0)).toBe(CLIP_TARGET_FLOOR);
    expect(computeClipTarget(Number.NaN)).toBe(CLIP_TARGET_FLOOR);
  });
});
