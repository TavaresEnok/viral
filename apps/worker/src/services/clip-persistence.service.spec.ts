import { describe, expect, it, vi } from 'vitest';
import type { ClipSuggestion } from '@viralforge/clip-analyzer';

function makeClip(overrides: Partial<ClipSuggestion> = {}): ClipSuggestion {
  return {
    title: 'Corte de teste',
    start: 10,
    end: 55,
    duration: 45,
    viral_score: 80,
    category: 'VIRAL',
    reason: 'Motivo viral',
    hook: 'Abertura forte',
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

const mockPrisma = {
  clip: {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  $transaction: vi.fn().mockResolvedValue([]),
};

describe('ClipPersistenceService', () => {
  async function getSvc() {
    const { ClipPersistenceService } = await import('./clip-persistence.service.js');
    return new ClipPersistenceService(mockPrisma as never);
  }

  it('computeFinalScore retorna finalScore >= 35', async () => {
    const svc = await getSvc();
    const result = svc.computeFinalScore(makeClip());
    expect(result.finalScore).toBeGreaterThanOrEqual(35);
    expect(result.finalScore).toBeLessThanOrEqual(99);
  });

  it('computeFinalScore aplica penalidade de highCutRisk', async () => {
    const svc = await getSvc();
    const low = svc.computeFinalScore(makeClip({ risk_of_bad_cut: 'low' }));
    const high = svc.computeFinalScore(makeClip({ risk_of_bad_cut: 'high' }));
    expect(high.rankScore).toBeLessThan(low.rankScore);
  });

  it('computeFinalScore aplica boost por número no texto', async () => {
    const svc = await getSvc();
    const withNumber = svc.computeFinalScore(makeClip({ hook: 'Top 5 estratégias', actual_text_in_clip: 'Top 5' }));
    const without = svc.computeFinalScore(makeClip({ hook: 'Estratégias', actual_text_in_clip: '' }));
    expect(withNumber.rankScore).toBeGreaterThanOrEqual(without.rankScore);
  });

  it('buildClipData ordena por rankScore decrescente', async () => {
    const svc = await getSvc();
    const clips = [
      makeClip({ viral_score: 60, opening_strength: 50, closing_strength: 50 }),
      makeClip({ viral_score: 95, opening_strength: 90, closing_strength: 90 }),
    ];
    const rows = svc.buildClipData('proj1', clips);
    expect(rows[0].viralScore).toBeGreaterThan(rows[1].viralScore);
  });

  it('buildClipData retorna lista vazia para array vazio', async () => {
    const svc = await getSvc();
    const rows = svc.buildClipData('proj1', []);
    expect(rows).toHaveLength(0);
  });

  it('buildClipData usa safeString para title nunca undefined', async () => {
    const svc = await getSvc();
    const clip = makeClip({ title: null as never });
    const [row] = svc.buildClipData('proj1', [clip]);
    expect(typeof row.title).toBe('string');
  });

  it('buildOperationalFallbackClips retorna até 5 clips', async () => {
    const svc = await getSvc();
    const segments = Array.from({ length: 20 }, (_, i) => ({
      start: i * 10,
      end: i * 10 + 8,
      text: `Conteúdo do segmento número ${i + 1} com texto suficiente para contar`,
    }));
    const result = svc.buildOperationalFallbackClips({ segments }, 45, 200);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.every((c) => c.needs_review)).toBe(true);
  });

  it('buildOperationalFallbackClips respeita videoDuration', async () => {
    const svc = await getSvc();
    const segments = [{ start: 0, end: 30, text: 'Conteúdo principal do vídeo bem longo aqui' }];
    const result = svc.buildOperationalFallbackClips({ segments }, 45, 20);
    expect(result).toHaveLength(0);
  });

  it('buildOperationalFallbackClips respeita o limite dinâmico de cortes', async () => {
    const svc = await getSvc();
    // Texto longo (>80 chars) p/ passar o gate de qualidade do fallback, e
    // espaçamento generoso p/ não colidir com o nextAllowedStart.
    const segments = Array.from({ length: 40 }, (_, i) => ({
      start: i * 130,
      end: i * 130 + 60,
      text: `Conteúdo detalhado e completo do segmento número ${i + 1}, com bastante texto para ultrapassar o limite mínimo de oitenta caracteres exigido pelo fallback operacional do pipeline.`,
    }));
    const target = 8;
    const result = svc.buildOperationalFallbackClips({ segments }, 45, 5400, target);
    expect(result.length).toBeLessThanOrEqual(target);
    expect(result.length).toBeGreaterThan(5); // prova que passa do antigo teto fixo de 5
  });

  it('toDisplayScore preserva ordem monotônica entre clips', async () => {
    const svc = await getSvc();
    const low = svc.computeFinalScore(
      makeClip({ opening_strength: 30, closing_strength: 30, quotability: 30 }),
    );
    const high = svc.computeFinalScore(
      makeClip({ opening_strength: 95, closing_strength: 95, quotability: 95 }),
    );
    expect(high.finalScore).toBeGreaterThanOrEqual(low.finalScore);
  });
});
