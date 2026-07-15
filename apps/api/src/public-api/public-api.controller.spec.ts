import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { PublicApiController } from './public-api.controller.js';

const publicApi = { validateApiKey: vi.fn() };
const prisma = { project: { findMany: vi.fn(), findFirst: vi.fn() }, clip: { findMany: vi.fn() } };
const projects = { normalizeYoutubeUrl: vi.fn(), create: vi.fn(), attachYoutubeUrl: vi.fn(), retry: vi.fn(), remove: vi.fn() };

describe('PublicApiController mutations', () => {
  let controller: PublicApiController;

  beforeEach(() => {
    vi.clearAllMocks();
    publicApi.validateApiKey.mockResolvedValue('user-1');
    projects.normalizeYoutubeUrl.mockImplementation((value: string) => value);
    controller = new PublicApiController(publicApi as never, prisma as never, projects as never);
  });

  it('exige API key', async () => {
    await expect(controller.listProjects(undefined as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cria projeto e inicia processamento da URL', async () => {
    const dto = {
      title: 'Podcast semanal',
      language: 'pt-BR',
      contentType: 'PODCAST',
      clipStyle: 'VIRAL',
      preferredClipDuration: 45,
      renderLayout: 'SMART_REFRAME',
      captionTheme: 'KARAOKE_PRO',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
    };
    projects.create.mockResolvedValue({ id: 'project-1' });
    projects.attachYoutubeUrl.mockResolvedValue({ id: 'project-1', title: dto.title, status: 'PENDING', progress: 5, createdAt: new Date() });

    const result = await controller.createProject('secret', dto as never);

    expect(projects.create).toHaveBeenCalledWith('user-1', dto);
    expect(projects.attachYoutubeUrl).toHaveBeenCalledWith('user-1', 'project-1', dto.sourceUrl);
    expect(result.project).toMatchObject({ id: 'project-1', status: 'PENDING' });
  });

  it('repete e exclui somente no escopo do dono autenticado', async () => {
    projects.retry.mockResolvedValue({ id: 'project-1', status: 'PENDING' });
    projects.remove.mockResolvedValue({ ok: true });
    await controller.retryProject('secret', 'project-1');
    await controller.deleteProject('secret', 'project-1');
    expect(projects.retry).toHaveBeenCalledWith('user-1', 'project-1');
    expect(projects.remove).toHaveBeenCalledWith('user-1', 'project-1');
  });
});
