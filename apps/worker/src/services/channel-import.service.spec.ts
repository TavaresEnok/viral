import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockYoutubeDl = vi.fn();
vi.mock('youtube-dl-exec', () => ({ youtubeDl: (...args: unknown[]) => mockYoutubeDl(...args) }));

const mockResolve4 = vi.fn();
vi.mock('node:dns', () => ({ promises: { resolve4: (...args: unknown[]) => mockResolve4(...args) } }));

describe('ChannelImportService', () => {
  let prisma: {
    channelImportRequest: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockResolve4.mockResolvedValue(['198.51.100.10']); // IP público, não privado
    prisma = {
      channelImportRequest: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
  });

  function baseRequest(overrides: Record<string, unknown> = {}) {
    return {
      id: 'req1',
      userId: 'user1',
      platform: 'TIKTOK',
      channelUrl: 'https://www.tiktok.com/@usuario',
      status: 'PENDING',
      ...overrides,
    };
  }

  it('solicitação inexistente encerra sem lançar (job descartado sem retry)', async () => {
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(null);

    await expect(service.listAndSave('sumiu', 'job1')).resolves.toBeUndefined();
    expect(mockYoutubeDl).not.toHaveBeenCalled();
  });

  it('recusa URL de host não permitido para a plataforma (ex.: youtube.com como "TikTok")', async () => {
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(
      baseRequest({ channelUrl: 'https://www.youtube.com/@usuario' }),
    );

    await expect(service.listAndSave('req1', 'job1')).rejects.toThrow(/não permitida/i);
    expect(mockYoutubeDl).not.toHaveBeenCalled();

    const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
    expect(updates.at(-1)).toMatchObject({ status: 'FAILED' });
  });

  it('recusa URL que resolve para IP privado (SSRF)', async () => {
    mockResolve4.mockResolvedValue(['192.168.1.5']);
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

    await expect(service.listAndSave('req1', 'job1')).rejects.toThrow(/SSRF/i);
    expect(mockYoutubeDl).not.toHaveBeenCalled();
  });

  it('lista vídeos a partir de um resultado flat-playlist (entries[])', async () => {
    mockYoutubeDl.mockResolvedValue({
      entries: [
        { url: 'https://www.tiktok.com/@usuario/video/1', title: 'Vídeo 1', duration: 30, thumbnail: 'a.jpg' },
        { webpage_url: 'https://www.tiktok.com/@usuario/video/2', title: 'Vídeo 2', duration: 45 },
        { title: 'Sem URL, deve ser descartado' },
      ],
    });
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

    await service.listAndSave('req1', 'job1');

    const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
    const final = updates.at(-1);
    expect(final.status).toBe('READY');
    expect(final.videosJson).toHaveLength(2);
    expect(final.videosJson[0]).toMatchObject({ url: 'https://www.tiktok.com/@usuario/video/1', title: 'Vídeo 1' });
    expect(final.videosJson[1]).toMatchObject({ url: 'https://www.tiktok.com/@usuario/video/2' });
  });

  it('lida com resposta em string JSON (dumpSingleJson via stdout)', async () => {
    mockYoutubeDl.mockResolvedValue(
      JSON.stringify({ entries: [{ url: 'https://www.tiktok.com/@u/video/9', title: 'V9' }] }),
    );
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

    await service.listAndSave('req1', 'job1');

    const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
    expect(updates.at(-1).videosJson).toHaveLength(1);
  });

  it('extrai mensagem de stderr quando o erro do subprocesso vem com .message vazio', async () => {
    // Regressão: erros do tinyspawn (usado por youtube-dl-exec) costumavam
    // chegar com message="" e sem stderr, salvando errorMessage="" — sem
    // nenhuma pista do que deu errado.
    const subprocessError = Object.assign(new Error(''), {
      stderr: 'ERROR: [TikTok] Unable to extract webpage\nENOENT',
      code: 'ENOENT',
    });
    mockYoutubeDl.mockRejectedValue(subprocessError);
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

    await expect(service.listAndSave('req1', 'job1')).rejects.toThrow();

    const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
    const failedUpdate = updates.find((u) => u.status === 'FAILED');
    expect(failedUpdate.errorMessage).not.toBe('');
    expect(failedUpdate.errorMessage).toContain('ENOENT');
  });

  it('marca FAILED quando nenhum vídeo público é encontrado', async () => {
    mockYoutubeDl.mockResolvedValue({ entries: [] });
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

    await expect(service.listAndSave('req1', 'job1')).rejects.toThrow(/nenhum vídeo/i);
    const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
    expect(updates.at(-1)).toMatchObject({ status: 'FAILED' });
  });
});
