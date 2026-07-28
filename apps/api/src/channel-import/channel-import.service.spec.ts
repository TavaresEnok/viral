import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChannelImportService } from './channel-import.service.js';
import type { ImportSelectedVideosDto } from './dto.js';

function readyRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req1',
    userId: 'user1',
    platform: 'TIKTOK',
    channelUrl: 'https://www.tiktok.com/@usuario',
    status: 'READY',
    videosJson: [
      { url: 'https://www.tiktok.com/@u/video/1', title: 'Vídeo 1' },
      { url: 'https://www.tiktok.com/@u/video/2', title: 'Vídeo 2' },
      { url: 'https://www.tiktok.com/@u/video/3', title: 'Vídeo 3' },
    ],
    ...overrides,
  };
}

const importDto: ImportSelectedVideosDto = {
  selectedUrls: [
    'https://www.tiktok.com/@u/video/1',
    'https://www.tiktok.com/@u/video/2',
    'https://www.tiktok.com/@u/video/3',
  ],
  contentType: 'PODCAST',
  clipStyle: 'VIRAL',
  language: 'pt-BR',
  preferredClipDuration: 45,
  renderLayout: 'BLURRED_BACKGROUND',
  captionTheme: 'CLEAN_FOOTER',
};

describe('ChannelImportService', () => {
  let prisma: {
    channelImportRequest: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    project: { create: ReturnType<typeof vi.fn> };
  };
  let queue: { addListChannelVideosJob: ReturnType<typeof vi.fn>; addVideoProcessingJob: ReturnType<typeof vi.fn> };
  let quota: { ensureCanCreateProject: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: ChannelImportService;

  beforeEach(() => {
    prisma = {
      channelImportRequest: { create: vi.fn(), findUnique: vi.fn() },
      project: { create: vi.fn() },
    };
    queue = {
      addListChannelVideosJob: vi.fn().mockResolvedValue({}),
      addVideoProcessingJob: vi.fn().mockResolvedValue({}),
    };
    quota = { ensureCanCreateProject: vi.fn().mockResolvedValue(undefined) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new ChannelImportService(prisma as never, queue as never, quota as never, audit as never);
  });

  describe('createRequest', () => {
    it('cria a solicitação e enfileira a listagem', async () => {
      prisma.channelImportRequest.create.mockResolvedValue({ id: 'req1' });

      await service.createRequest('user1', { platform: 'TIKTOK', channelUrl: 'https://www.tiktok.com/@u' } as never);

      expect(queue.addListChannelVideosJob).toHaveBeenCalledWith({
        jobType: 'LIST_CHANNEL_VIDEOS',
        userId: 'user1',
        requestId: 'req1',
      });
    });
  });

  describe('importSelected', () => {
    it('recusa importar antes da listagem ficar pronta', async () => {
      prisma.channelImportRequest.findUnique.mockResolvedValue(readyRequest({ status: 'LISTING' }));

      await expect(service.importSelected('user1', 'req1', importDto)).rejects.toThrow(ForbiddenException);
      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    it('ignora URLs selecionadas que não pertencem à listagem', async () => {
      prisma.channelImportRequest.findUnique.mockResolvedValue(readyRequest());
      prisma.project.create.mockImplementation(({ data }) => Promise.resolve({ id: `proj-${data.sourceUrl}` }));

      const result = await service.importSelected('user1', 'req1', {
        ...importDto,
        selectedUrls: ['https://www.tiktok.com/@u/video/1', 'https://outro-dominio.com/video/x'],
      } as never);

      expect(result.imported).toBe(1);
      expect(prisma.project.create).toHaveBeenCalledTimes(1);
    });

    it('rejeita quando NENHUMA URL selecionada pertence à listagem', async () => {
      prisma.channelImportRequest.findUnique.mockResolvedValue(readyRequest());

      await expect(
        service.importSelected('user1', 'req1', { ...importDto, selectedUrls: ['https://x.com/video/9'] } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('cria um Project por vídeo selecionado, com sourceUrl, e enfileira PROCESS_PROJECT', async () => {
      prisma.channelImportRequest.findUnique.mockResolvedValue(readyRequest());
      prisma.project.create.mockImplementation(({ data }) => Promise.resolve({ id: `proj-${data.sourceUrl}` }));

      const result = await service.importSelected('user1', 'req1', importDto);

      expect(result.imported).toBe(3);
      expect(result.quotaExceeded).toBe(false);
      expect(prisma.project.create).toHaveBeenCalledTimes(3);
      expect(queue.addVideoProcessingJob).toHaveBeenCalledTimes(3);
      const firstCreateData = prisma.project.create.mock.calls[0][0].data;
      expect(firstCreateData).toMatchObject({
        userId: 'user1',
        sourceUrl: 'https://www.tiktok.com/@u/video/1',
        status: 'PENDING',
        title: 'Vídeo 1',
      });
    });

    it('para de importar no primeiro estouro de quota, mantendo o que já foi criado', async () => {
      prisma.channelImportRequest.findUnique.mockResolvedValue(readyRequest());
      prisma.project.create.mockImplementation(({ data }) => Promise.resolve({ id: `proj-${data.sourceUrl}` }));
      quota.ensureCanCreateProject
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ForbiddenException('quota esgotada'));

      const result = await service.importSelected('user1', 'req1', importDto);

      expect(result.imported).toBe(1);
      expect(result.requested).toBe(3);
      expect(result.quotaExceeded).toBe(true);
      expect(prisma.project.create).toHaveBeenCalledTimes(1);
    });
  });
});
