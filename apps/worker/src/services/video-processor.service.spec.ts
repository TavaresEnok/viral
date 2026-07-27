/**
 * Testes do orquestrador do pipeline.
 *
 * É o arquivo mais crítico do worker (roteia todo tipo de job e aplica as
 * guardas de quota e de IA) e não tinha nenhum teste. Aqui ficam travadas as
 * decisões que, se quebrarem em silêncio, custam dinheiro ou processam além
 * do que o usuário contratou.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { VideoProcessorService } from './video-processor.service.js';

type AnyRecord = Record<string, unknown>;

/** Dependências mockadas com o mínimo que o caminho testado exercita. */
function buildDeps(overrides: AnyRecord = {}) {
  const deps = {
    prisma: {
      project: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
      userQuota: { findUnique: vi.fn().mockResolvedValue(null) },
    },
    apiKeys: { getKeys: vi.fn().mockResolvedValue({ llmApiKey: null, llmModel: 'deepseek-chat' }) },
    ffmpeg: {
      probeDuration: vi.fn().mockResolvedValue(600),
      hasVideoStream: vi.fn().mockResolvedValue(true),
      extractAudio: vi.fn().mockResolvedValue(undefined),
    },
    validation: { validate: vi.fn().mockReturnValue([]) },
    youtubeDownload: {},
    youtubePublish: {},
    tiktokPublish: {},
    instagramPublish: {},
    transcript: {
      loadCachedTranscript: vi.fn().mockResolvedValue(null),
      tryBuildYoutubeTranscript: vi.fn().mockResolvedValue(null),
      buildTranscript: vi.fn(),
      ensureTranscriptWords: vi.fn((t: unknown) => t),
      saveTranscript: vi.fn().mockResolvedValue(undefined),
    },
    clips: {},
    metrics: {
      // measure/measureSync apenas cronometram: aqui executam a função direto.
      measure: vi.fn(async (_t: AnyRecord, _k: string, fn: () => unknown) => fn()),
      measureSync: vi.fn((_t: AnyRecord, _k: string, fn: () => unknown) => fn()),
      stage: vi.fn().mockResolvedValue(undefined),
      elapsedSec: vi.fn().mockReturnValue(1),
      savePipelineRunMetric: vi.fn().mockResolvedValue(undefined),
    },
    render: { renderSingleClip: vi.fn().mockResolvedValue(undefined) },
    feedbackProfile: { buildFeedbackNotes: vi.fn().mockResolvedValue(undefined) },
    transcription: {},
    ...overrides,
  };

  const service = new VideoProcessorService(
    deps.prisma as never,
    deps.apiKeys as never,
    deps.ffmpeg as never,
    deps.validation as never,
    deps.youtubeDownload as never,
    deps.youtubePublish as never,
    deps.tiktokPublish as never,
    deps.instagramPublish as never,
    deps.transcript as never,
    deps.clips as never,
    deps.metrics as never,
    deps.render as never,
    deps.feedbackProfile as never,
    deps.transcription as never,
  );

  return { service, deps };
}

describe('VideoProcessorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_AI_FALLBACK;
  });

  afterEach(() => {
    delete process.env.ALLOW_AI_FALLBACK;
  });

  describe('roteamento por tipo de job', () => {
    it('RENDER_CLIP vai para o orquestrador de render', async () => {
      const { service, deps } = buildDeps();

      await service.process(
        { jobType: 'RENDER_CLIP', clipId: 'clip1', projectId: 'p1', userId: 'u1' } as never,
        'job1',
      );

      expect(deps.render.renderSingleClip).toHaveBeenCalledTimes(1);
      // Não pode encostar no pipeline completo de projeto.
      expect(deps.prisma.project.findUnique).not.toHaveBeenCalled();
    });

    it('job sem jobType cai no pipeline de projeto', async () => {
      const { service, deps } = buildDeps();
      deps.prisma.project.findUnique.mockResolvedValue(null);

      await service.process({ projectId: 'p1', userId: 'u1' } as never, 'job1');

      expect(deps.prisma.project.findUnique).toHaveBeenCalledTimes(1);
      expect(deps.render.renderSingleClip).not.toHaveBeenCalled();
    });
  });

  describe('guardas do pipeline de projeto', () => {
    it('projeto inexistente encerra sem lançar (não gera retry infinito)', async () => {
      const { service, deps } = buildDeps();
      deps.prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.process({ projectId: 'sumiu', userId: 'u1' } as never, 'job1'),
      ).resolves.toBeUndefined();

      // Descartado antes de baixar/transcodificar qualquer coisa.
      expect(deps.ffmpeg.probeDuration).not.toHaveBeenCalled();
    });

    it('recusa vídeo que estoura o saldo de minutos do usuário', async () => {
      const { service, deps } = buildDeps();
      deps.prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        language: 'pt-BR',
        clipStyle: 'VIRAL',
        contentType: 'PODCAST',
        preferredClipDuration: 45,
        originalFilePath: '/tmp/v.mp4',
      });
      // Vídeo de 1h contra saldo de 10 minutos.
      deps.ffmpeg.probeDuration.mockResolvedValue(3600);
      deps.prisma.userQuota.findUnique.mockResolvedValue({
        maxProjectMinutesPerMonth: 60,
        monthlyProjectMinutes: 50,
        maxRendersPerMonth: 20,
        monthlyRenders: 0,
      });

      // Registra a falha no projeto E relança, para o BullMQ tratar retry/DLQ.
      await expect(
        service.process(
          { projectId: 'p1', userId: 'u1', originalFilePath: '/tmp/v.mp4' } as never,
          'job1',
        ),
      ).rejects.toThrow(/saldo/i);

      // A falha fica registrada na telemetria do projeto, não passa batido.
      expect(deps.metrics.stage).toHaveBeenCalledWith(
        'p1',
        'FAILED',
        100,
        'FAILED',
        expect.stringMatching(/saldo/i),
      );
      // E nada de transcrever/analisar: falhou antes de gastar.
      expect(deps.transcript.saveTranscript).not.toHaveBeenCalled();
    });

    it('sem provider de IA e com fallback desativado, falha explicitamente', async () => {
      process.env.ALLOW_AI_FALLBACK = 'false';
      const { service, deps } = buildDeps();
      deps.prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        language: 'pt-BR',
        clipStyle: 'VIRAL',
        contentType: 'PODCAST',
        preferredClipDuration: 45,
        originalFilePath: '/tmp/v.mp4',
      });
      deps.transcript.loadCachedTranscript.mockResolvedValue({
        segments: [{ start: 0, end: 5, text: 'oi' }],
        fullText: 'oi',
        language: 'pt-BR',
        source: 'cached',
      });

      await expect(
        service.process(
          { projectId: 'p1', userId: 'u1', originalFilePath: '/tmp/v.mp4' } as never,
          'job1',
        ),
      ).rejects.toThrow(/ALLOW_AI_FALLBACK/i);

      expect(deps.metrics.stage).toHaveBeenCalledWith(
        'p1',
        'FAILED',
        100,
        'FAILED',
        expect.stringMatching(/ALLOW_AI_FALLBACK|provider de IA/i),
      );
      // Falhou na etapa de análise, registrada na telemetria do pipeline.
      const runMetric = deps.metrics.savePipelineRunMetric.mock.calls.at(-1)?.[0] as AnyRecord;
      expect(runMetric?.status).toBe('FAILED');
      expect(runMetric?.failedStage).toBe('ANALYZING_CLIPS');
    });
  });
});
