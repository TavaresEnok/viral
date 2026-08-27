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

  it('extrai thumbnail de thumbnails[] quando o campo singular thumbnail não vem (caso real do TikTok)', async () => {
    // Regressão: TikTok não preenche `thumbnail` no modo flat-playlist — a
    // miniatura real vem em `thumbnails: [{id, url}]`. Sem o fallback, todo
    // vídeo do TikTok ficava sem thumbnail na UI.
    mockYoutubeDl.mockResolvedValue({
      entries: [
        {
          url: 'https://www.tiktok.com/@u/video/1',
          title: 'Vídeo com capa',
          thumbnails: [
            { id: 'originCover', url: 'https://cdn.tiktok.com/origin.jpg' },
            { id: 'cover', url: 'https://cdn.tiktok.com/cover.jpg' },
          ],
        },
        {
          url: 'https://www.tiktok.com/@u/video/2',
          title: 'Sem id cover, usa o primeiro',
          thumbnails: [{ id: 'x', url: 'https://cdn.tiktok.com/only.jpg' }],
        },
      ],
    });
    const { ChannelImportService } = await import('./channel-import.service.js');
    const service = new ChannelImportService(prisma as never);
    prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

    await service.listAndSave('req1', 'job1');

    const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
    const videos = updates.at(-1).videosJson;
    expect(videos[0].thumbnailUrl).toBe('https://cdn.tiktok.com/cover.jpg');
    expect(videos[1].thumbnailUrl).toBe('https://cdn.tiktok.com/only.jpg');
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

  describe('paginação ("ver mais")', () => {
    it('usa o total já salvo como offset (playlistStart) na próxima busca', async () => {
      mockYoutubeDl.mockResolvedValue({ entries: [{ url: 'https://www.tiktok.com/@u/video/99', title: 'V99' }] });
      const { ChannelImportService } = await import('./channel-import.service.js');
      const service = new ChannelImportService(prisma as never);
      const jaSalvos = Array.from({ length: 50 }, (_, i) => ({ url: `https://www.tiktok.com/@u/video/${i}`, title: `V${i}` }));
      prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest({ videosJson: jaSalvos }));

      await service.listAndSave('req1', 'job1');

      const [, flags] = mockYoutubeDl.mock.calls[0];
      expect(flags).toMatchObject({ playlistStart: 51, playlistEnd: 100 });
    });

    it('acrescenta a nova página ao total existente (não sobrescreve)', async () => {
      mockYoutubeDl.mockResolvedValue({
        entries: [{ url: 'https://www.tiktok.com/@u/video/novo', title: 'Novo vídeo' }],
      });
      const { ChannelImportService } = await import('./channel-import.service.js');
      const service = new ChannelImportService(prisma as never);
      const existentes = [{ url: 'https://www.tiktok.com/@u/video/velho', title: 'Vídeo antigo' }];
      prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest({ videosJson: existentes }));

      await service.listAndSave('req1', 'job1');

      const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
      const final = updates.at(-1);
      expect(final.videosJson).toHaveLength(2);
      expect(final.videosJson.map((v: { url: string }) => v.url)).toEqual([
        'https://www.tiktok.com/@u/video/velho',
        'https://www.tiktok.com/@u/video/novo',
      ]);
    });

    it('não duplica vídeo que já estava salvo (dedup por url)', async () => {
      mockYoutubeDl.mockResolvedValue({
        entries: [{ url: 'https://www.tiktok.com/@u/video/repetido', title: 'Repetido' }],
      });
      const { ChannelImportService } = await import('./channel-import.service.js');
      const service = new ChannelImportService(prisma as never);
      const existentes = [{ url: 'https://www.tiktok.com/@u/video/repetido', title: 'Repetido' }];
      prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest({ videosJson: existentes }));

      await service.listAndSave('req1', 'job1');

      const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
      expect(updates.at(-1).videosJson).toHaveLength(1);
    });

    it('marca hasMore=true quando a página vem cheia (provável haver mais)', async () => {
      const pageSize = 50; // default de CHANNEL_IMPORT_PAGE_SIZE
      mockYoutubeDl.mockResolvedValue({
        entries: Array.from({ length: pageSize }, (_, i) => ({ url: `https://www.tiktok.com/@u/video/${i}`, title: `V${i}` })),
      });
      const { ChannelImportService } = await import('./channel-import.service.js');
      const service = new ChannelImportService(prisma as never);
      prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

      await service.listAndSave('req1', 'job1');

      const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
      expect(updates.at(-1)).toMatchObject({ hasMore: true });
    });

    it('marca hasMore=false quando a página vem incompleta (fim do canal)', async () => {
      mockYoutubeDl.mockResolvedValue({ entries: [{ url: 'https://www.tiktok.com/@u/video/ultimo', title: 'Último' }] });
      const { ChannelImportService } = await import('./channel-import.service.js');
      const service = new ChannelImportService(prisma as never);
      prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest());

      await service.listAndSave('req1', 'job1');

      const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
      expect(updates.at(-1)).toMatchObject({ hasMore: false });
    });

    it('não falha com "nenhum vídeo encontrado" quando já existem vídeos e a nova página vem vazia', async () => {
      // Fim do canal: a pagina seguinte pode vir vazia sem que isso seja erro,
      // já que ha vídeos válidos acumulados de páginas anteriores.
      mockYoutubeDl.mockResolvedValue({ entries: [] });
      const { ChannelImportService } = await import('./channel-import.service.js');
      const service = new ChannelImportService(prisma as never);
      const existentes = [{ url: 'https://www.tiktok.com/@u/video/1', title: 'V1' }];
      prisma.channelImportRequest.findUnique.mockResolvedValue(baseRequest({ videosJson: existentes }));

      await expect(service.listAndSave('req1', 'job1')).resolves.toBeUndefined();
      const updates = prisma.channelImportRequest.update.mock.calls.map((c) => c[0].data);
      expect(updates.at(-1)).toMatchObject({ status: 'READY', hasMore: false });
    });
  });
});
