import { describe, it, expect } from 'vitest';
import { validateBoundaryAlignment } from './text-validation.js';

const REAL_TEXT =
  'Eu trabalhei na Globo por 12 anos e tem uma coisa que ninguém nunca contou. ' +
  'O problema nunca foi o salário, era a rotina que destruía qualquer pessoa. ' +
  'E foi aí que eu entendi que dinheiro nunca foi o problema. Era medo.';

describe('validateBoundaryAlignment', () => {
  it('considera alinhado quando hook e closing batem com as bordas', () => {
    const result = validateBoundaryAlignment(
      'Eu trabalhei na Globo por 12 anos',
      'dinheiro nunca foi o problema. Era medo.',
      REAL_TEXT,
    );
    expect(result.startAligned).toBe(true);
    expect(result.endAligned).toBe(true);
    expect(result.startSimilarity).toBeGreaterThanOrEqual(0.8);
    expect(result.endSimilarity).toBeGreaterThanOrEqual(0.8);
  });

  it('tolera diferencas de acentuacao e pontuacao', () => {
    const result = validateBoundaryAlignment(
      'eu trabalhei na globo por 12 anos!!!',
      'dinheiro nunca foi o problema era medo',
      REAL_TEXT,
    );
    expect(result.startAligned).toBe(true);
    expect(result.endAligned).toBe(true);
  });

  it('detecta hook que nao esta no comeco do intervalo', () => {
    const result = validateBoundaryAlignment(
      'Trabalhar em CLT no Brasil é o pior negócio que existe',
      undefined,
      REAL_TEXT,
    );
    expect(result.startAligned).toBe(false);
    expect(result.startSimilarity).toBeLessThan(0.5);
  });

  it('detecta closing que nao esta no fim do intervalo', () => {
    const result = validateBoundaryAlignment(
      undefined,
      'você acha mesmo que isso é coincidência? Pensa.',
      REAL_TEXT,
    );
    expect(result.endAligned).toBe(false);
    expect(result.endSimilarity).toBeLessThan(0.5);
  });

  it('nao penaliza quando hook esta no comeco mas closing nao veio', () => {
    const result = validateBoundaryAlignment('Eu trabalhei na Globo por 12 anos', undefined, REAL_TEXT);
    expect(result.startAligned).toBe(true);
    expect(result.endAligned).toBe(true);
    expect(result.endSimilarity).toBeNull();
  });

  it('considera alinhado quando os campos declarados estao ausentes ou curtos demais', () => {
    const result = validateBoundaryAlignment(undefined, 'medo', REAL_TEXT);
    expect(result.startAligned).toBe(true);
    expect(result.endAligned).toBe(true);
    expect(result.startSimilarity).toBeNull();
    expect(result.endSimilarity).toBeNull();
  });

  it('considera alinhado quando o texto real esta vazio', () => {
    const result = validateBoundaryAlignment('Hook qualquer aqui', 'fechamento qualquer', '');
    expect(result.startAligned).toBe(true);
    expect(result.endAligned).toBe(true);
  });
});
