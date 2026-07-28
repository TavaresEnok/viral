import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuickCaptionService } from './quick-caption.service.js';

function baseBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch1',
    userId: 'user1',
    name: 'Lote de teste',
    renderLayout: 'BLURRED_BACKGROUND',
    captionTheme: 'CLEAN_FOOTER',
    items: [],
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item1',
    batchId: 'batch1',
    originalFilePath: '/path/original.mp4',
    captionText: 'Legenda',
    status: 'DRAFT',
    ...overrides,
  };
}

describe('QuickCaptionService', () => {
  let prisma: {
    quickCaptionBatch: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    quickCaptionItem: { update: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  };
  let queue: { addRenderBulkItemJob: ReturnType<typeof vi.fn> };
  let quota: { ensureCanRenderBatch: ReturnType<typeof vi.fn> };
  let service: QuickCaptionService;

  beforeEach(() => {
    prisma = {
      quickCaptionBatch: { findUnique: vi.fn(), create: vi.fn() },
      quickCaptionItem: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn() },
    };
    queue = { addRenderBulkItemJob: vi.fn().mockResolvedValue({}) };
    quota = { ensureCanRenderBatch: vi.fn().mockResolvedValue(undefined) };
    service = new QuickCaptionService(prisma as never, queue as never, quota as never);
  });

  describe('renderBatch', () => {
    it('rejeita quando nenhum item tem vídeo + legenda', async () => {
      prisma.quickCaptionBatch.findUnique.mockResolvedValue(
        baseBatch({ items: [item({ captionText: '' }), item({ originalFilePath: null })] }),
      );

      await expect(service.renderBatch('user1', 'batch1')).rejects.toThrow(BadRequestException);
      expect(queue.addRenderBulkItemJob).not.toHaveBeenCalled();
    });

    it('verifica a quota ANTES de enfileirar qualquer item', async () => {
      prisma.quickCaptionBatch.findUnique.mockResolvedValue(baseBatch({ items: [item(), item({ id: 'item2' })] }));
      quota.ensureCanRenderBatch.mockRejectedValue(new ForbiddenException('sem quota'));

      await expect(service.renderBatch('user1', 'batch1')).rejects.toThrow(ForbiddenException);
      expect(queue.addRenderBulkItemJob).not.toHaveBeenCalled();
    });

    it('enfileira apenas os itens prontos e ignora os que já estão renderizando', async () => {
      prisma.quickCaptionBatch.findUnique.mockResolvedValue(
        baseBatch({
          items: [item({ id: 'a' }), item({ id: 'b', status: 'RENDERING' }), item({ id: 'c', captionText: '' })],
        }),
      );

      const result = await service.renderBatch('user1', 'batch1');

      expect(result.queued).toBe(1);
      expect(quota.ensureCanRenderBatch).toHaveBeenCalledWith('user1', 1);
      expect(queue.addRenderBulkItemJob).toHaveBeenCalledTimes(1);
      expect(queue.addRenderBulkItemJob).toHaveBeenCalledWith({
        jobType: 'RENDER_BULK_ITEM',
        userId: 'user1',
        itemId: 'a',
      });
    });
  });

  describe('updateItem', () => {
    it('recusa edição de item que está renderizando', async () => {
      prisma.quickCaptionItem.findUnique.mockResolvedValue(item({ userId: 'user1', status: 'RENDERING' }));

      await expect(
        service.updateItem('user1', 'item1', { captionText: 'nova legenda' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('volta o item COMPLETED para DRAFT ao editar a legenda (precisa renderizar de novo)', async () => {
      prisma.quickCaptionItem.findUnique.mockResolvedValue(item({ userId: 'user1', status: 'COMPLETED' }));

      await service.updateItem('user1', 'item1', { captionText: 'nova legenda' });

      expect(prisma.quickCaptionItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: { captionText: 'nova legenda', status: 'DRAFT' },
      });
    });
  });
});
