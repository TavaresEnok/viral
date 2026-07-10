import { describe, it, expect } from 'vitest';
import { FeedbackProfileService } from './feedback-profile.service.js';
import type { PrismaService } from './prisma.service.js';

function makeService(reasons: string[]): FeedbackProfileService {
  const prisma = {
    clipFeedback: {
      findMany: async () => reasons.map((reason) => ({ reason })),
    },
  } as unknown as PrismaService;
  return new FeedbackProfileService(prisma);
}

describe('FeedbackProfileService', () => {
  it('retorna undefined com amostra insuficiente', async () => {
    const svc = makeService(['WEAK_END', 'WEAK_END']);
    expect(await svc.buildFeedbackNotes('user-1')).toBeUndefined();
  });

  it('gera orientação para motivo dominante', async () => {
    const svc = makeService(['WEAK_END', 'WEAK_END', 'WEAK_END', 'WEAK_END', 'NOT_VIRAL', 'OTHER']);
    const notes = await svc.buildFeedbackNotes('user-1');
    expect(notes).toContain('closing_strength');
    expect(notes).toContain('4 de 6');
  });

  it('ignora motivos abaixo do limiar e OTHER', async () => {
    const svc = makeService(['OTHER', 'OTHER', 'OTHER', 'OTHER', 'WEAK_START', 'BAD_CAPTION']);
    expect(await svc.buildFeedbackNotes('user-1')).toBeUndefined();
  });

  it('gera múltiplas orientações quando há mais de um motivo recorrente', async () => {
    const svc = makeService([
      'WEAK_START', 'WEAK_START', 'WEAK_START',
      'MISSING_CONTEXT', 'MISSING_CONTEXT', 'MISSING_CONTEXT',
    ]);
    const notes = await svc.buildFeedbackNotes('user-1');
    expect(notes).toContain('opening_strength');
    expect(notes).toContain('context_independence_score');
  });
});
