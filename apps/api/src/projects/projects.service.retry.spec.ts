import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

// retry() apaga arquivos em disco antes de apagar os registros — isolado do
// filesystem real para o teste ficar determinístico e rápido.
vi.mock('../common/storage-cleanup.helper.js', () => ({
  deleteProjectFiles: vi.fn().mockResolvedValue(undefined),
  deleteClipFiles: vi.fn().mockResolvedValue(undefined),
  safeUnlink: vi.fn().mockResolvedValue(undefined),
}));

function baseProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj1',
    userId: 'user1',
    status: 'FAILED',
    originalFilePath: '/data/uploads/user1/proj1/original.mp4',
    sourceUrl: null,
    audioFilePath: null,
    ...overrides,
  };
}

describe('ProjectsService.retry — regressão do "Record to update not found"', () => {
  let prisma: {
    project: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    clip: { findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
    clipFeedback: { deleteMany: ReturnType<typeof vi.fn> };
    transcript: { deleteMany: ReturnType<typeof vi.fn> };
    processingJob: {
      deleteMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let queueService: { addVideoProcessingJob: ReturnType<typeof vi.fn> };
  let quotaService: { ensureCanStartProcessing: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: import('./projects.service.js').ProjectsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = {
      project: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue(baseProject()) },
      clip: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockReturnValue(Promise.resolve({ count: 0 })) },
      clipFeedback: { deleteMany: vi.fn().mockReturnValue(Promise.resolve({ count: 0 })) },
      transcript: { deleteMany: vi.fn().mockReturnValue(Promise.resolve({ count: 0 })) },
      processingJob: {
        deleteMany: vi.fn().mockReturnValue(Promise.resolve({ count: 0 })),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    queueService = { addVideoProcessingJob: vi.fn().mockResolvedValue({}) };
    quotaService = { ensureCanStartProcessing: vi.fn().mockResolvedValue(undefined) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };

    const { ProjectsService } = await import('./projects.service.js');
    service = new ProjectsService(prisma as never, queueService as never, quotaService as never, audit as never);
  });

  it('recusa retry enquanto o projeto ainda está PROCESSING', async () => {
    // Este é o cenário exato do bug: um job em andamento está atualizando um
    // Clip no banco no momento em que o retry apagaria esse mesmo registro.
    prisma.project.findUnique.mockResolvedValue(baseProject({ status: 'PROCESSING' }));

    await expect(service.retry('user1', 'proj1')).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(queueService.addVideoProcessingJob).not.toHaveBeenCalled();
  });

  it('recusa retry enquanto o projeto ainda está PENDING (na fila, não começou)', async () => {
    prisma.project.findUnique.mockResolvedValue(baseProject({ status: 'PENDING' }));

    await expect(service.retry('user1', 'proj1')).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa retry num projeto DRAFT (não é para isso que o retry existe)', async () => {
    prisma.project.findUnique.mockResolvedValue(baseProject({ status: 'DRAFT' }));

    await expect(service.retry('user1', 'proj1')).rejects.toThrow(ForbiddenException);
  });

  it('permite retry normalmente quando o projeto está FAILED', async () => {
    prisma.project.findUnique.mockResolvedValue(baseProject({ status: 'FAILED' }));

    await expect(service.retry('user1', 'proj1')).resolves.toBeDefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(queueService.addVideoProcessingJob).toHaveBeenCalledTimes(1);
  });

  it('a checagem de status vem ANTES da checagem de vídeo/URL (mensagem de erro certa em cada caso)', async () => {
    prisma.project.findUnique.mockResolvedValue(
      baseProject({ status: 'PROCESSING', originalFilePath: null, sourceUrl: null }),
    );

    // Sem a ordem certa, um projeto PROCESSING sem arquivo devolveria a
    // mensagem errada ("sem vídeo") em vez da real ("ainda processando").
    await expect(service.retry('user1', 'proj1')).rejects.toThrow(ForbiddenException);
    await expect(service.retry('user1', 'proj1')).rejects.not.toThrow(BadRequestException);
  });
});
