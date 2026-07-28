import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BulkCaptionRenderService } from './bulk-caption-render.service.js';

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item1',
    batchId: 'batch1',
    userId: 'user1',
    originalFilePath: '/storage/user1/quick-caption/batch1/item1/original.mp4',
    captionText: 'Legenda digitada pelo usuário',
    durationSeconds: 30,
    status: 'PENDING',
    videoPath: null,
    thumbnailPath: null,
    errorMessage: null,
    batch: { renderLayout: 'BLURRED_BACKGROUND', captionTheme: 'CLEAN_FOOTER' },
    ...overrides,
  };
}

describe('BulkCaptionRenderService', () => {
  let prisma: { quickCaptionItem: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
  let rendering: { renderClip: ReturnType<typeof vi.fn> };
  let service: BulkCaptionRenderService;

  beforeEach(() => {
    prisma = {
      quickCaptionItem: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    rendering = {
      renderClip: vi.fn().mockResolvedValue({
        videoPath: '/out/clip.mp4',
        thumbnailPath: '/out/thumb.jpg',
        srtPath: '/out/subtitle.srt',
        vttPath: '/out/subtitle.vtt',
        renderEngine: 'ffmpeg',
        renderDurationMs: 1200,
        smartCrop: null,
      }),
    };
    service = new BulkCaptionRenderService(prisma as never, rendering as never);
  });

  it('item inexistente encerra sem lançar (job descartado sem retry)', async () => {
    prisma.quickCaptionItem.findUnique.mockResolvedValue(null);
    await expect(service.renderItem('sumiu', 'job1')).resolves.toBeUndefined();
    expect(rendering.renderClip).not.toHaveBeenCalled();
  });

  it('recusa item sem vídeo enviado', async () => {
    prisma.quickCaptionItem.findUnique.mockResolvedValue(baseItem({ originalFilePath: null }));
    await expect(service.renderItem('item1', 'job1')).rejects.toThrow(/sem vídeo/i);
    expect(rendering.renderClip).not.toHaveBeenCalled();
  });

  it('recusa item sem legenda digitada', async () => {
    prisma.quickCaptionItem.findUnique.mockResolvedValue(baseItem({ captionText: '   ' }));
    await expect(service.renderItem('item1', 'job1')).rejects.toThrow(/sem legenda/i);
    expect(rendering.renderClip).not.toHaveBeenCalled();
  });

  it('recusa item sem duração conhecida', async () => {
    prisma.quickCaptionItem.findUnique.mockResolvedValue(baseItem({ durationSeconds: null }));
    await expect(service.renderItem('item1', 'job1')).rejects.toThrow(/duração/i);
    expect(rendering.renderClip).not.toHaveBeenCalled();
  });

  it('renderiza com legenda estática cobrindo o vídeo inteiro e salva o resultado', async () => {
    prisma.quickCaptionItem.findUnique.mockResolvedValue(baseItem());

    await service.renderItem('item1', 'job1');

    expect(rendering.renderClip).toHaveBeenCalledTimes(1);
    const [inputPath, syntheticClip, segments, options] = rendering.renderClip.mock.calls[0];
    expect(inputPath).toBe('/storage/user1/quick-caption/batch1/item1/original.mp4');
    expect(syntheticClip).toMatchObject({ id: 'item1', start: 0, end: 30, duration: 30 });
    expect(segments).toEqual([{ start: 0, end: 30, text: 'Legenda digitada pelo usuário' }]);
    expect(options).toMatchObject({ captionTheme: 'CLEAN_FOOTER', renderLayout: 'BLURRED_BACKGROUND' });

    const updates = prisma.quickCaptionItem.update.mock.calls.map((c) => c[0].data);
    expect(updates[0]).toMatchObject({ status: 'RENDERING' });
    expect(updates.at(-1)).toMatchObject({ status: 'COMPLETED', videoPath: '/out/clip.mp4' });
  });

  it('marca FAILED com a mensagem de erro e relança quando o render falha', async () => {
    prisma.quickCaptionItem.findUnique.mockResolvedValue(baseItem());
    rendering.renderClip.mockRejectedValue(new Error('ffmpeg explodiu'));

    await expect(service.renderItem('item1', 'job1')).rejects.toThrow('ffmpeg explodiu');

    const updates = prisma.quickCaptionItem.update.mock.calls.map((c) => c[0].data);
    expect(updates.at(-1)).toMatchObject({ status: 'FAILED', errorMessage: 'ffmpeg explodiu' });
  });
});
