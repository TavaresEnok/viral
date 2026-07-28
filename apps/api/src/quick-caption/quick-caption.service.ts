import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { QuotaService } from '../quota/quota.service.js';
import type { CreateBatchDto, UpdateBatchDto, UpdateItemDto } from './dto.js';

@Injectable()
export class QuickCaptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly quota: QuotaService,
  ) {}

  async createBatch(userId: string, dto: CreateBatchDto) {
    return this.prisma.quickCaptionBatch.create({
      data: {
        userId,
        name: dto.name ?? 'Lote sem título',
        renderLayout: dto.renderLayout ?? 'BLURRED_BACKGROUND',
        captionTheme: dto.captionTheme ?? 'CLEAN_FOOTER',
      },
    });
  }

  async listBatches(userId: string) {
    return this.prisma.quickCaptionBatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getBatch(userId: string, batchId: string) {
    const batch = await this.prisma.quickCaptionBatch.findUnique({
      where: { id: batchId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!batch || batch.userId !== userId) {
      throw new NotFoundException('Lote não encontrado');
    }
    return batch;
  }

  async updateBatch(userId: string, batchId: string, dto: UpdateBatchDto) {
    await this.ensureOwnedBatch(userId, batchId);
    return this.prisma.quickCaptionBatch.update({
      where: { id: batchId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.renderLayout !== undefined ? { renderLayout: dto.renderLayout } : {}),
        ...(dto.captionTheme !== undefined ? { captionTheme: dto.captionTheme } : {}),
      },
    });
  }

  async deleteBatch(userId: string, batchId: string) {
    await this.ensureOwnedBatch(userId, batchId);
    await this.prisma.quickCaptionBatch.delete({ where: { id: batchId } });
    return { success: true };
  }

  async ensureOwnedBatch(userId: string, batchId: string) {
    const batch = await this.prisma.quickCaptionBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.userId !== userId) {
      throw new NotFoundException('Lote não encontrado');
    }
    return batch;
  }

  async getOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.quickCaptionItem.findUnique({ where: { id: itemId } });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Item não encontrado');
    }
    return item;
  }

  async createItem(userId: string, batchId: string, originalFilePath: string, durationSeconds: number) {
    await this.ensureOwnedBatch(userId, batchId);
    return this.prisma.quickCaptionItem.create({
      data: { batchId, userId, originalFilePath, durationSeconds, status: 'DRAFT' },
    });
  }

  async updateItem(userId: string, itemId: string, dto: UpdateItemDto) {
    const item = await this.getOwnedItem(userId, itemId);
    if (item.status === 'RENDERING') {
      throw new ForbiddenException('Não é possível editar um item enquanto ele está sendo renderizado');
    }
    return this.prisma.quickCaptionItem.update({
      where: { id: itemId },
      data: { captionText: dto.captionText, status: item.status === 'COMPLETED' || item.status === 'FAILED' ? 'DRAFT' : item.status },
    });
  }

  async deleteItem(userId: string, itemId: string) {
    await this.getOwnedItem(userId, itemId);
    await this.prisma.quickCaptionItem.delete({ where: { id: itemId } });
    return { success: true };
  }

  /**
   * Enfileira o render de todos os itens prontos do lote (com vídeo + legenda).
   * Cada item consome 1 unidade de quota de render, como um clip normal.
   */
  async renderBatch(userId: string, batchId: string) {
    const batch = await this.getBatch(userId, batchId);
    const renderable = batch.items.filter(
      (item) => item.originalFilePath && item.captionText.trim().length > 0 && item.status !== 'RENDERING',
    );

    if (!renderable.length) {
      throw new BadRequestException(
        'Nenhum item pronto para renderizar. Cada item precisa de um vídeo enviado e uma legenda digitada.',
      );
    }

    await this.quota.ensureCanRenderBatch(userId, renderable.length);

    for (const item of renderable) {
      await this.prisma.quickCaptionItem.update({
        where: { id: item.id },
        data: { status: 'PENDING', errorMessage: null },
      });
      await this.queue.addRenderBulkItemJob({ jobType: 'RENDER_BULK_ITEM', userId, itemId: item.id });
    }

    return { queued: renderable.length };
  }
}
