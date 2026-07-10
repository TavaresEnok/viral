import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClipsService } from './clips.service.js';

const mockPrisma = {
  clip: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  project: { findFirst: vi.fn() },
  clipFeedback: { upsert: vi.fn() },
  $transaction: vi.fn(),
};
const mockQueue = {};
const mockQuota = {};
const mockAudit = { record: vi.fn() };

const mockClip = {
  id: 'clip-1',
  projectId: 'project-1',
  start: 10,
  end: 30,
  duration: 20,
  viralScore: 85,
  finalScore: 75,
  status: 'COMPLETED' as const,
  videoPath: null,
  thumbnailPath: null,
  srtPath: null,
  vttPath: null,
  renderLayout: null,
  captionTheme: null,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProject = {
  id: 'project-1',
  userId: 'user-1',
  durationSeconds: 120,
};

describe('ClipsService', () => {
  let service: ClipsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CLIP_RENDER_TIMEOUT_MINUTES = '5';

    service = new ClipsService(
      mockPrisma as never,
      mockQueue as never,
      mockQuota as never,
      mockAudit as never,
    );
  });

  describe('getOwnedClip', () => {
    it('returns clip when owned by user', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.getOwnedClip('user-1', 'clip-1');

      expect(result).toEqual(mockClip);
      expect(mockPrisma.clip.findFirst).toHaveBeenCalledWith({
        where: { id: 'clip-1', project: { userId: 'user-1' } },
      });
    });

    it('throws NotFoundException when clip not owned', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(null);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.getOwnedClip('user-1', 'clip-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTiming', () => {
    it('updates timing with valid duration', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      mockPrisma.clip.update.mockResolvedValue({ ...mockClip, start: 5, end: 25, duration: 20 });

      const result = await service.updateTiming('user-1', 'clip-1', { start: 5, end: 25 });

      expect(result.duration).toBe(20);
      expect(mockPrisma.clip.update).toHaveBeenCalled();
    });

    it('throws on duration shorter than 5s', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateTiming('user-1', 'clip-1', { start: 10, end: 13 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws on duration longer than 90s', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateTiming('user-1', 'clip-1', { start: 10, end: 200 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when end exceeds project duration', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      await expect(
        service.updateTiming('user-1', 'clip-1', { start: 10, end: 130 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('feedback', () => {
    it('creates feedback via upsert', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });
      const upserted = { clipId: 'clip-1', userId: 'user-1', reason: 'LOW_QUALITY', note: 'Too blurry' };
      mockPrisma.clipFeedback.upsert.mockResolvedValue(upserted);

      const result = await service.feedback('user-1', 'clip-1', {
        reason: 'LOW_QUALITY' as never,
        note: 'Too blurry',
      });

      expect(result).toEqual(upserted);
      expect(mockPrisma.clipFeedback.upsert).toHaveBeenCalledWith({
        where: { clipId_userId: { clipId: 'clip-1', userId: 'user-1' } },
        update: { reason: 'LOW_QUALITY', note: 'Too blurry' },
        create: { clipId: 'clip-1', userId: 'user-1', reason: 'LOW_QUALITY', note: 'Too blurry' },
      });
    });

    it('updates existing feedback via upsert', async () => {
      mockPrisma.clip.findFirst.mockResolvedValue(mockClip);
      mockPrisma.clip.updateMany.mockResolvedValue({ count: 0 });
      const updated = { clipId: 'clip-1', userId: 'user-1', reason: 'OFF_TOPIC', note: null };
      mockPrisma.clipFeedback.upsert.mockResolvedValue(updated);

      const result = await service.feedback('user-1', 'clip-1', { reason: 'OFF_TOPIC' as never });

      expect(result.reason).toBe('OFF_TOPIC');
      expect(mockPrisma.clipFeedback.upsert).toHaveBeenCalled();
    });
  });
});
