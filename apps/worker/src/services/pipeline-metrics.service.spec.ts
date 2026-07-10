import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockPrisma = {
  project: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  processingJob: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  pipelineRunMetric: { create: vi.fn().mockResolvedValue({}) },
};

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    publish: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('@viralforge/shared', () => ({
  createRedisConnectionConfig: vi.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
}));

describe('PipelineMetricsService', () => {
  beforeEach(() => vi.clearAllMocks());

  async function getSvc() {
    const { PipelineMetricsService } = await import('./pipeline-metrics.service.js');
    const svc = new PipelineMetricsService(mockPrisma as never);
    await svc.onModuleInit();
    return svc;
  }

  it('elapsedSec retorna número não-negativo', async () => {
    const svc = await getSvc();
    const start = performance.now();
    const elapsed = svc.elapsedSec(start);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('measure executa fn e registra timing', async () => {
    const svc = await getSvc();
    const timings: Record<string, number> = {};
    const result = await svc.measure(timings, 'my_step', async () => 42);
    expect(result).toBe(42);
    expect(typeof timings.my_step).toBe('number');
    expect(timings.my_step).toBeGreaterThanOrEqual(0);
  });

  it('measureSync executa fn e registra timing', async () => {
    const svc = await getSvc();
    const timings: Record<string, number> = {};
    const result = svc.measureSync(timings, 'sync_step', () => 'ok');
    expect(result).toBe('ok');
    expect(typeof timings.sync_step).toBe('number');
  });

  it('measure propaga erro da fn e ainda registra timing', async () => {
    const svc = await getSvc();
    const timings: Record<string, number> = {};
    await expect(
      svc.measure(timings, 'fail_step', async () => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');
    expect(timings.fail_step).toBeGreaterThanOrEqual(0);
  });

  it('stage atualiza projeto e cria processingJob', async () => {
    const svc = await getSvc();
    await svc.stage('proj1', 'TRANSCRIBING', 25);
    expect(mockPrisma.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'proj1' } }),
    );
    expect(mockPrisma.processingJob.create).toHaveBeenCalled();
  });

  it('stage lança erro quando projeto não existe', async () => {
    mockPrisma.project.updateMany.mockResolvedValueOnce({ count: 0 });
    const svc = await getSvc();
    await expect(svc.stage('missing', 'FAILED', 100, 'FAILED')).rejects.toThrow();
  });

  it('upsertProcessingJob faz update quando job já existe', async () => {
    mockPrisma.processingJob.findFirst.mockResolvedValueOnce({ id: 'job-123' });
    const svc = await getSvc();
    await svc.upsertProcessingJob('proj1', 'TRANSCRIBING', 25, 'PROCESSING');
    expect(mockPrisma.processingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-123' } }),
    );
  });

  it('savePipelineRunMetric não lança em caso de erro do DB', async () => {
    mockPrisma.pipelineRunMetric.create.mockRejectedValueOnce(new Error('db error'));
    const svc = await getSvc();
    await expect(
      svc.savePipelineRunMetric({
        projectId: 'proj1',
        jobId: 'job1',
        status: 'COMPLETED',
        totalSec: 10,
        stageTimings: {},
      }),
    ).resolves.toBeUndefined();
  });
});
