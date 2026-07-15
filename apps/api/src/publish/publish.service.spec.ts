import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PublishService } from './publish.service.js';

const prisma = {
  publishedClip: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
const queue = { addPublishJob: vi.fn() };
const audit = { record: vi.fn() };

describe('PublishService calendar', () => {
  let service: PublishService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    service = new PublishService(prisma as never, queue as never, audit as never);
  });

  it('limita consultas do calendário a 370 dias', async () => {
    await expect(service.listCalendar('user-1', '2026-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.publishedClip.findMany).not.toHaveBeenCalled();
  });

  it('filtra calendário por proprietário, período, status e plataforma', async () => {
    prisma.publishedClip.findMany.mockResolvedValue([]);
    await service.listCalendar('user-1', '2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 'PENDING', 'YOUTUBE');
    expect(prisma.publishedClip.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        socialAccount: { userId: 'user-1' },
        status: 'PENDING',
        platform: 'YOUTUBE',
      }),
    }));
  });

  it('reagenda atomicamente uma publicação pendente', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
    prisma.publishedClip.findFirst.mockResolvedValue({
      id: 'pub-1',
      status: 'PENDING',
      scheduledAt: new Date('2026-07-14T12:00:00.000Z'),
      clip: { category: 'education' },
    });
    prisma.publishedClip.updateMany.mockResolvedValue({ count: 1 });
    prisma.publishedClip.findUnique.mockResolvedValue({ id: 'pub-1' });

    await service.reschedule('user-1', 'pub-1', '2026-07-15T18:00:00.000Z');

    expect(prisma.publishedClip.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'pub-1', status: 'PENDING' }),
      data: { scheduledAt: new Date('2026-07-15T18:00:00.000Z') },
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish.reschedule_clip' }));
  });

  it('não reage agenda já publicada', async () => {
    prisma.publishedClip.findFirst.mockResolvedValue({ id: 'pub-1', status: 'PUBLISHED', scheduledAt: new Date(), clip: { category: 'education' } });
    await expect(service.reschedule('user-1', 'pub-1', '2030-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancela somente item pendente usando claim atômico', async () => {
    prisma.publishedClip.findFirst.mockResolvedValue({
      id: 'pub-1',
      status: 'PENDING',
      scheduledAt: new Date('2030-01-01T00:00:00.000Z'),
      platform: 'INSTAGRAM',
    });
    prisma.publishedClip.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.cancelScheduled('user-1', 'pub-1')).resolves.toEqual({ ok: true });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish.cancel_scheduled_clip' }));
  });
});
