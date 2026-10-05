import { describe, expect, it } from 'vitest';
import { aiFallbackAllowed, computeClipTarget, CLIP_TARGET_CEIL } from './pipeline.types.js';

describe('aiFallbackAllowed', () => {
  it('permite fallback por padrão (env ausente)', () => {
    expect(aiFallbackAllowed({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it('desliga fallback com ALLOW_AI_FALLBACK=false (case/espaco-insensivel)', () => {
    expect(aiFallbackAllowed({ ALLOW_AI_FALLBACK: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(aiFallbackAllowed({ ALLOW_AI_FALLBACK: ' FALSE ' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('qualquer outro valor mantém fallback ligado', () => {
    expect(aiFallbackAllowed({ ALLOW_AI_FALLBACK: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(aiFallbackAllowed({ ALLOW_AI_FALLBACK: '0' } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe('computeClipTarget', () => {
  it('não escala mais pela duração — pede o teto cheio independente da minutagem', () => {
    // Um vídeo de 10 min denso pode ter tantos cortes bons quanto um de 2h;
    // quem filtra por quantidade de verdade é o score (>=75) na validação,
    // não a duração do vídeo.
    expect(computeClipTarget(60)).toBe(CLIP_TARGET_CEIL); // 1 min
    expect(computeClipTarget(600)).toBe(CLIP_TARGET_CEIL); // 10 min
    expect(computeClipTarget(1200)).toBe(CLIP_TARGET_CEIL); // 20 min
    expect(computeClipTarget(3600)).toBe(CLIP_TARGET_CEIL); // 1h
    expect(computeClipTarget(36000)).toBe(CLIP_TARGET_CEIL); // 10h
  });

  it('limita pelo saldo de renders quando informado', () => {
    expect(computeClipTarget(3600, 3)).toBe(3); // teto 30, mas só 3 de saldo
    expect(computeClipTarget(600, 8)).toBe(8); // vídeo curto, saldo de 8 -> 8
    expect(computeClipTarget(3600, 50)).toBe(CLIP_TARGET_CEIL); // saldo folgado -> teto
  });

  it('ignora saldo zero/negativo e devolve o teto cheio (gate de quota trata depois)', () => {
    expect(computeClipTarget(3600, 0)).toBe(CLIP_TARGET_CEIL);
    expect(computeClipTarget(3600, -5)).toBe(CLIP_TARGET_CEIL);
  });

  it('lida com duração inválida (0/NaN) sem quebrar — duração não influencia mais o resultado', () => {
    expect(computeClipTarget(0)).toBe(CLIP_TARGET_CEIL);
    expect(computeClipTarget(Number.NaN)).toBe(CLIP_TARGET_CEIL);
  });
});
