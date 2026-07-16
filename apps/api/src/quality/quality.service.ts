import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0);
}

function scoreBucket(score: number) {
  if (score >= 90) return '90-100';
  if (score >= 80) return '80-89';
  if (score >= 70) return '70-79';
  return '0-69';
}

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      // select explícito: `transcript: true` trazia segmentsJson/wordsJson/
      // fullText (dezenas de MB por projeto × 50) para usar 4 campos — caminho
      // direto para OOM. Idem clips, que traziam faceTrackJson/scoreBreakdown.
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        createdAt: true,
        durationSeconds: true,
        errorMessage: true,
        llmCostEstimate: true,
        llmPass1Tokens: true,
        llmPass2Tokens: true,
        transcript: {
          select: { source: true, sourceModel: true, qualityScore: true, qualityWarnings: true },
        },
        clips: {
          orderBy: [{ finalScore: 'desc' as const }, { viralScore: 'desc' as const }],
          select: {
            status: true,
            finalScore: true,
            viralScore: true,
            openingStrength: true,
            closingStrength: true,
            renderDurationMs: true,
            renderEngine: true,
            feedbacks: { select: { reason: true } },
          },
        },
        jobs: { orderBy: { createdAt: 'asc' as const }, select: { stage: true } },
      },
    });

    const clips = projects.flatMap((project) => project.clips);
    const completedProjects = projects.filter((project) => project.status === 'COMPLETED').length;
    const failedProjects = projects.filter((project) => project.status === 'FAILED').length;
    const downloadedProxy = clips.filter((clip) => clip.feedbacks.length === 0 && clip.status === 'COMPLETED').length;
    const feedbacks = clips.flatMap((clip) => clip.feedbacks);
    // Histograma diagnóstico usa o score HONESTO (viralScore), não o finalScore.
    // finalScore passou a ser um valor de APRESENTAÇÃO (curva calibrada para a
    // faixa competitiva), então usá-lo aqui empurraria tudo para 80-99 e
    // esconderia regressões reais de qualidade do modelo.
    const bucketCounts = clips.reduce<Record<string, number>>((acc, clip) => {
      const bucket = scoreBucket(clip.viralScore);
      acc[bucket] = (acc[bucket] ?? 0) + 1;
      return acc;
    }, {});

    const projectsWithCost = projects.filter((p) => p.llmCostEstimate != null);
    const totalCost = sum(projectsWithCost.map((p) => p.llmCostEstimate ?? 0));
    const totalTokens = sum(projects.map((p) => (p.llmPass1Tokens ?? 0) + (p.llmPass2Tokens ?? 0)));
    const pipelineMetrics = await this.prisma.pipelineRunMetric.findMany({
      where: { project: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const completedMetrics = pipelineMetrics.filter((metric) => metric.status === 'COMPLETED');
    const failedMetrics = pipelineMetrics.filter((metric) => metric.status === 'FAILED');
    const avgMetric = (selector: (metric: (typeof pipelineMetrics)[number]) => number | null | undefined) =>
      average(pipelineMetrics.map((metric) => selector(metric) ?? 0).filter(Boolean));
    const failureByStage = Object.entries(
      failedMetrics.reduce<Record<string, number>>((acc, metric) => {
        const stage = metric.failedStage ?? 'unknown';
        acc[stage] = (acc[stage] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([stage, count]) => ({ stage, count }));
    const renderEngineBreakdown = Object.entries(
      pipelineMetrics.reduce<Record<string, number>>((acc, metric) => {
        const engines = metric.renderEngines && typeof metric.renderEngines === 'object' ? metric.renderEngines as Record<string, unknown> : {};
        for (const [engine, count] of Object.entries(engines)) {
          acc[engine] = (acc[engine] ?? 0) + (typeof count === 'number' ? count : 0);
        }
        return acc;
      }, {}),
    ).map(([engine, count]) => ({ engine, count }));
    return {
      totals: {
        projects: projects.length,
        completedProjects,
        failedProjects,
        clips: clips.length,
        completedClips: clips.filter((clip) => clip.status === 'COMPLETED').length,
        badFeedbacks: feedbacks.length,
        // averageViralScore = honesto (rubrica severa). averageFinalScore = o
        // que o usuário vê (curva de apresentação). O contraste entre os dois é
        // intencional: um mede qualidade real, o outro o número exibido.
        averageViralScore: average(clips.map((clip) => clip.viralScore)),
        averageFinalScore: average(clips.map((clip) => clip.finalScore ?? clip.viralScore)),
        averageTranscriptQuality: average(projects.map((project) => project.transcript?.qualityScore ?? 0).filter((v) => v > 0)),
        averageClosingStrength: average(clips.map((clip) => clip.closingStrength ?? clip.viralScore)),
        averageOpeningStrength: average(clips.map((clip) => clip.openingStrength ?? clip.viralScore)),
        averageRenderDurationMs: average(clips.map((clip) => clip.renderDurationMs ?? 0).filter(Boolean)),
        remotionRenderedClips: clips.filter((clip) => clip.renderEngine === 'remotion').length,
        projectCompletionRate: projects.length ? Math.round((completedProjects / projects.length) * 100) : 0,
        projectFailureRate: projects.length ? Math.round((failedProjects / projects.length) * 100) : 0,
        clipBadRate: clips.length ? Math.round((feedbacks.length / clips.length) * 100) : 0,
        completedClipProxyRate: clips.length ? Math.round((downloadedProxy / clips.length) * 100) : 0,
        totalLlmTokens: totalTokens,
        totalLlmCostEstimate: Math.round(totalCost * 100) / 100,
        averageLlmCostPerProject: projectsWithCost.length > 0 ? Math.round((totalCost / projectsWithCost.length) * 1000) / 1000 : 0,
        pipelineRuns: pipelineMetrics.length,
        pipelineFailureRate: pipelineMetrics.length ? Math.round((failedMetrics.length / pipelineMetrics.length) * 100) : 0,
        averagePipelineTotalSec: avgMetric((metric) => metric.totalSec),
        averageDownloadSec: avgMetric((metric) => this.stageTiming(metric.stageTimings, 'download_video_sec')),
        averageCaptionsSec: avgMetric((metric) => this.stageTiming(metric.stageTimings, 'youtube_captions_sec')),
        averageAsrSec: avgMetric((metric) => metric.asrTotalSec ?? this.stageTiming(metric.stageTimings, 'audio_asr_total_sec')),
        averageLlmAnalyzeSec: avgMetric((metric) => this.stageTiming(metric.stageTimings, 'llm_analyze_sec')),
        averageRenderTotalSec: avgMetric((metric) => this.stageTiming(metric.stageTimings, 'render_total_sec')),
        remoteGpuUseRate: pipelineMetrics.length ? Math.round((pipelineMetrics.filter((metric) => metric.remoteGpuUsed).length / pipelineMetrics.length) * 100) : 0,
        fallbackUseRate: pipelineMetrics.length ? Math.round((pipelineMetrics.filter((metric) => metric.fallbackUsed).length / pipelineMetrics.length) * 100) : 0,
        averagePass1Candidates: avgMetric((metric) => metric.pass1CandidateCount),
        averageApprovedClips: avgMetric((metric) => metric.approvedClipCount),
        averagePass2RejectionRate: avgMetric((metric) => metric.rejectionRate ? metric.rejectionRate * 100 : null),
      },
      pipeline: {
        runs: pipelineMetrics.length,
        completed: completedMetrics.length,
        failed: failedMetrics.length,
        failureByStage,
        renderEngineBreakdown,
        recentRuns: pipelineMetrics.slice(0, 12).map((metric) => ({
          id: metric.id,
          projectId: metric.projectId,
          jobId: metric.jobId,
          status: metric.status,
          failedStage: metric.failedStage,
          errorMessage: metric.errorMessage,
          totalSec: metric.totalSec,
          remoteGpuUsed: metric.remoteGpuUsed,
          fallbackUsed: metric.fallbackUsed,
          renderEngines: metric.renderEngines,
          createdAt: metric.createdAt,
        })),
      },
      scoreBuckets: ['90-100', '80-89', '70-79', '0-69'].map((bucket) => ({
        bucket,
        count: bucketCounts[bucket] ?? 0,
      })),
      badReasons: Object.entries(
        feedbacks.reduce<Record<string, number>>((acc, feedback) => {
          acc[feedback.reason] = (acc[feedback.reason] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([reason, count]) => ({ reason, count })),
      recentProjects: projects.map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        progress: project.progress,
        createdAt: project.createdAt,
        durationSeconds: project.durationSeconds,
        clipCount: project.clips.length,
        completedClipCount: project.clips.filter((clip) => clip.status === 'COMPLETED').length,
        failedClipCount: project.clips.filter((clip) => clip.status === 'FAILED').length,
        averageViralScore: average(project.clips.map((clip) => clip.viralScore)),
        averageFinalScore: average(project.clips.map((clip) => clip.finalScore ?? clip.viralScore)),
        averageClosingStrength: average(project.clips.map((clip) => clip.closingStrength ?? clip.viralScore)),
        averageOpeningStrength: average(project.clips.map((clip) => clip.openingStrength ?? clip.viralScore)),
        averageRenderDurationMs: average(project.clips.map((clip) => clip.renderDurationMs ?? 0).filter(Boolean)),
        transcriptSource: project.transcript?.source ?? null,
        transcriptSourceModel: project.transcript?.sourceModel ?? null,
        transcriptQualityScore: project.transcript?.qualityScore ?? null,
        transcriptWarnings: project.transcript?.qualityWarnings ?? null,
        lastStage: project.jobs.at(-1)?.stage ?? null,
        errorMessage: project.errorMessage,
      })),
    };
  }

  private stageTiming(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return null;
    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === 'number' ? raw : null;
  }
}
