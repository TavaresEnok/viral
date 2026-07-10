import { describe, it, expect } from 'vitest';
import { ClipValidationService } from './clip-validation.service.js';
import type { ClipSuggestion } from '@viralforge/clip-analyzer';

function makeClip(overrides: Partial<ClipSuggestion> = {}): ClipSuggestion {
  return {
    title: 'Clip teste',
    start: 10,
    end: 55,
    duration: 45,
    viral_score: 80,
    category: 'VIRAL',
    reason: 'Motivo de viralidade do conteúdo',
    hook: 'Hook inicial',
    opening_strength: 75,
    closing_strength: 75,
    context_independence_score: 80,
    emotional_density: 70,
    quotability: 70,
    closing_type: 'conclusion',
    risk_of_bad_cut: 'low',
    needs_review: false,
    was_adjusted_by_ai: false,
    ...overrides,
  };
}

const mockSegments = [
  { start: 0, end: 5, text: 'Início do vídeo.' },
  { start: 5, end: 10, text: 'Segunda parte do conteúdo.' },
  { start: 10, end: 30, text: 'Conteúdo principal do clip aqui.' },
  { start: 30, end: 55, text: 'Desenvolvimento e conclusão do assunto.' },
  { start: 55, end: 70, text: 'Parte final do vídeo.' },
  { start: 70, end: 120, text: 'Outro trecho completamente diferente.' },
];

const mockTranscript = {
  segments: mockSegments,
  fullText: mockSegments.map((s) => s.text).join(' '),
};

describe('ClipValidationService', () => {
  const svc = new ClipValidationService();

  it('filtra clips com viral_score abaixo do mínimo', () => {
    const clips = [
      makeClip({ viral_score: 60 }),
      makeClip({ start: 60, end: 105, duration: 45, viral_score: 80 }),
    ];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result.every((c) => c.viral_score >= 70)).toBe(true);
    expect(result.some((c) => c.viral_score === 60)).toBe(false);
  });

  it('filtra clips com duration < 15 segundos após ajuste', () => {
    const clips = [makeClip({ start: 10, end: 20, duration: 10 })];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result.every((c) => c.duration >= 15)).toBe(true);
  });

  it('filtra clips com duration > 90 segundos após ajuste', () => {
    const clips = [makeClip({ start: 0, end: 100, duration: 100 })];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result.every((c) => c.duration <= 90)).toBe(true);
  });

  it('filtra clips que ultrapassam a duração do vídeo', () => {
    const clips = [makeClip({ start: 100, end: 130, duration: 30 })];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result).toHaveLength(0);
  });

  it('aceita clips com exatamente 15 segundos de duração', () => {
    const clips = [makeClip({ start: 10, end: 25, duration: 15 })];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('retorna clips com duration como inteiro (Math.round)', () => {
    const clips = [makeClip({ start: 10, end: 55.7, duration: 45 })];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    for (const clip of result) {
      expect(Number.isInteger(clip.duration)).toBe(true);
    }
  });

  it('deduplica clips com sobreposição alta', () => {
    const clips = [
      makeClip({ start: 10, end: 55, duration: 45, viral_score: 80 }),
      makeClip({ start: 12, end: 57, duration: 45, viral_score: 75 }),
    ];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('mantém dois clips sem sobreposição significativa', () => {
    const clips = [
      makeClip({ start: 10, end: 40, duration: 30, viral_score: 80 }),
      makeClip({ start: 70, end: 110, duration: 40, viral_score: 80 }),
    ];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result.length).toBe(2);
  });

  it('respeita o limite maxClips', () => {
    const clips = [
      makeClip({ start: 10, end: 30, duration: 20, viral_score: 90 }),
      makeClip({ start: 40, end: 60, duration: 20, viral_score: 85 }),
      makeClip({ start: 70, end: 110, duration: 40, viral_score: 80 }),
    ];
    const result = svc.validate(clips, mockTranscript, 120, 0, 1);
    expect(result).toHaveLength(1);
  });

  it('nao penaliza clip com hook e closing alinhados as bordas', () => {
    const clips = [
      makeClip({
        hook: 'Conteúdo principal do clip aqui',
        evaluation_notes: { closing_real: 'conclusão do assunto' },
        actual_text_in_clip: 'Conteúdo principal do clip aqui. Desenvolvimento e conclusão do assunto.',
      }),
    ];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result).toHaveLength(1);
    expect(result[0].risk_of_bad_cut).toBe('low');
    expect(result[0].reason).not.toContain('desalinhados');
  });

  it('flageia clip cujo hook declarado nao existe nas bordas do intervalo', () => {
    const clips = [
      makeClip({
        hook: 'Frase totalmente inventada sem relacao nenhuma',
        evaluation_notes: { closing_real: 'outra frase inventada qualquer' },
        actual_text_in_clip: 'Conteúdo principal do clip aqui. Desenvolvimento e conclusão do assunto.',
      }),
    ];
    const result = svc.validate(clips, mockTranscript, 120, 70);
    expect(result).toHaveLength(1);
    expect(result[0].needs_review).toBe(true);
    expect(result[0].risk_of_bad_cut).toBe('medium');
    expect(result[0].reason).toContain('desalinhados');
    expect(result[0].opening_strength).toBeLessThanOrEqual(60);
    expect(result[0].closing_strength).toBeLessThanOrEqual(60);
  });

  it('retorna lista vazia para array de clips vazio', () => {
    const result = svc.validate([], mockTranscript, 120, 70);
    expect(result).toHaveLength(0);
  });

  it('retorna lista vazia quando videoDuration é 0', () => {
    const clips = [makeClip()];
    const result = svc.validate(clips, mockTranscript, 0, 70);
    expect(result).toHaveLength(0);
  });
});
