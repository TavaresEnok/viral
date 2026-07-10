import { Injectable, Logger } from "@nestjs/common";
import { LlmClipAnalyzerService, type LlmTelemetry } from "@viralforge/clip-analyzer";
import type { QueueJobPayload } from "@viralforge/shared";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { computeClipTarget, type RenderClipsSummary, type TranscriptWithMetadata } from "../types/pipeline.types.js";
import { ApiKeyService } from "./api-key.service.js";
import { ClipPersistenceService } from "./clip-persistence.service.js";
import { ClipValidationService } from "./clip-validation.service.js";
import { FeedbackProfileService } from "./feedback-profile.service.js";
import { FfmpegService } from "./ffmpeg.service.js";
import { InstagramPublishService } from "./instagram-publish.service.js";
import { PipelineMetricsService } from "./pipeline-metrics.service.js";
import { PrismaService } from "./prisma.service.js";
import { RenderOrchestrationService } from "./render-orchestration.service.js";
import { TikTokPublishService } from "./tiktok-publish.service.js";
import { TranscriptOrchestrationService } from "./transcript-orchestration.service.js";
import { YoutubeDownloadService } from "./youtube-download.service.js";
import { YoutubePublishService } from "./youtube-publish.service.js";

function repoRoot() {
    return process.cwd().endsWith("/apps/worker")
        ? resolve(process.cwd(), "../..")
        : process.cwd();
}

const MODEL_COST_PER_1K: Record<string, number> = {
    "deepseek-chat": 0.00027,
    "deepseek-reasoner": 0.00055,
    "gpt-4o-mini": 0.00015,
    "gpt-4o": 0.0025,
    "claude-3-haiku-20240307": 0.00025,
    "claude-3-sonnet-20240229": 0.003,
    "gemini/gemini-2.0-flash-001": 0.00015,
};

@Injectable()
export class VideoProcessorService {
    private readonly logger = new Logger(VideoProcessorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly apiKeys: ApiKeyService,
        private readonly ffmpeg: FfmpegService,
        private readonly validation: ClipValidationService,
        private readonly youtubeDownload: YoutubeDownloadService,
        private readonly youtubePublish: YoutubePublishService,
        private readonly tiktokPublish: TikTokPublishService,
        private readonly instagramPublish: InstagramPublishService,
        private readonly transcript: TranscriptOrchestrationService,
        private readonly clips: ClipPersistenceService,
        private readonly metrics: PipelineMetricsService,
        private readonly render: RenderOrchestrationService,
        private readonly feedbackProfile: FeedbackProfileService,
    ) {}

    async process(payload: QueueJobPayload, jobId: string) {
        if (payload.jobType === "RENDER_CLIP") {
            await this.render.renderSingleClip(payload, jobId);
            return;
        }
        if (payload.jobType === "PUBLISH_CLIP") {
            await this.publishClip(payload, jobId);
            return;
        }
        await this.processProject(payload, jobId);
    }

    private async processProject(
        payload: Extract<QueueJobPayload, { jobType?: "PROCESS_PROJECT" }>,
        jobId: string,
    ) {
        const log = (msg: string, extra?: Record<string, unknown>) =>
            this.logger.log({ msg, jobId, projectId: payload.projectId, userId: payload.userId, ...extra });

        const runStartedAt = performance.now();
        const stageTimings: Record<string, number> = {};
        let currentStage = "STARTING";
        let duration: number | null = null;
        let transcriptForMetrics: TranscriptWithMetadata | null = null;
        let llmTelemetryForMetrics: LlmTelemetry | null = null;
        let llmCostForMetrics: number | null = null;
        let rawClipCountForMetrics: number | null = null;
        let validatedClipCountForMetrics: number | null = null;
        let renderSummaryForMetrics: RenderClipsSummary | null = null;

        log("Iniciando processamento do projeto");
        try {
            const project = await this.prisma.project.findUnique({
                where: { id: payload.projectId },
            });
            if (!project) {
                log("Projeto não existe mais; job descartado sem retry");
                return;
            }
            const keys = await this.apiKeys.getKeys(payload.userId);
            const sanitizedUserId = payload.userId.replace(/[^a-zA-Z0-9_-]/g, "");
            const sanitizedProjectId = payload.projectId.replace(/[^a-zA-Z0-9_-]/g, "");
            const baseDir = resolve(
                repoRoot(),
                process.env.STORAGE_ROOT ?? "storage/uploads",
                sanitizedUserId,
                sanitizedProjectId,
            );
            const audioPath = resolve(baseDir, "audio.mp3");

            currentStage = "DOWNLOADING_VIDEO";
            const originalFilePath = await this.metrics.measure(
                stageTimings,
                payload.sourceUrl ? "download_video_sec" : "resolve_original_file_sec",
                () => this.resolveOriginalFile(payload, baseDir, jobId),
            );
            duration = await this.metrics.measure(
                stageTimings,
                "probe_duration_sec",
                () => this.ffmpeg.probeDuration(originalFilePath),
            );
            await this.prisma.project.update({
                where: { id: payload.projectId },
                data: { durationSeconds: duration },
            });

            const durationUserQuota = await this.prisma.userQuota.findUnique({
                where: { userId: payload.userId },
            });
            const maxMinutes = durationUserQuota ? durationUserQuota.maxProjectMinutesPerMonth : 60;
            const usedMinutes = durationUserQuota ? durationUserQuota.monthlyProjectMinutes : 0;
            const durationMinutes = Math.ceil(duration / 60);
            if (usedMinutes + durationMinutes > maxMinutes) {
                throw new Error(
                    `A duração do vídeo excede o saldo disponível de ${maxMinutes - usedMinutes} minutos.`,
                );
            }

            // Alvo dinâmico de cortes: escala com a duração do vídeo (como Opus
            // Clip/Vizard) em vez do antigo fixo 5, sem ultrapassar o saldo de
            // renders do usuário.
            const remainingRenders = Math.max(
                0,
                (durationUserQuota ? durationUserQuota.maxRendersPerMonth : 20) -
                    (durationUserQuota ? durationUserQuota.monthlyRenders : 0),
            );
            const clipTarget = computeClipTarget(duration, remainingRenders);
            log(`Alvo de cortes para este vídeo: ${clipTarget}`, {
                stage: "ANALYZING_CLIPS",
                durationSec: duration,
                remainingRenders,
            });

            let transcriptData: TranscriptWithMetadata | null = null;

            const cachedTranscript = await this.transcript.loadCachedTranscript(payload.projectId);
            if (cachedTranscript) {
                currentStage = "TRANSCRIBING";
                log("Reusando transcrição já salva", {
                    stage: "TRANSCRIBING",
                    source: cachedTranscript.source ?? "cached",
                    segments: cachedTranscript.segments.length,
                });
                await this.metrics.stage(payload.projectId, "TRANSCRIBING", 25);
                transcriptData = cachedTranscript;
            }

            if (!transcriptData && payload.sourceUrl) {
                currentStage = "TRANSCRIBING";
                log("Transcrevendo", { stage: "TRANSCRIBING", source: "youtube_captions" });
                await this.metrics.stage(payload.projectId, "TRANSCRIBING", 25);
                transcriptData = await this.metrics.measure(
                    stageTimings,
                    "youtube_captions_sec",
                    () =>
                        this.transcript.tryBuildYoutubeTranscript(
                            payload.sourceUrl!,
                            baseDir,
                            project.language,
                        ),
                );
                if (!transcriptData && process.env.YOUTUBE_CAPTIONS_ONLY === "true") {
                    throw new Error(
                        "Modo rápido por legenda está ativo, mas o YouTube não entregou legenda utilizável para este vídeo.",
                    );
                }
            }

            if (!transcriptData) {
                currentStage = "EXTRACTING_AUDIO";
                log("Extraindo áudio", { stage: "EXTRACTING_AUDIO" });
                await this.metrics.stage(payload.projectId, "EXTRACTING_AUDIO", 10);
                await this.metrics.measure(stageTimings, "extract_audio_sec", () =>
                    this.ffmpeg.extractAudio(originalFilePath, audioPath),
                );
                await this.prisma.project.update({
                    where: { id: payload.projectId },
                    data: { audioFilePath: audioPath },
                });
                currentStage = "TRANSCRIBING";
                log("Transcrevendo", { stage: "TRANSCRIBING", source: "audio_asr" });
                await this.metrics.stage(payload.projectId, "TRANSCRIBING", 25);
                transcriptData = await this.metrics.measure(
                    stageTimings,
                    "audio_asr_total_sec",
                    () =>
                        this.transcript.buildTranscript({
                            sourceUrl: payload.sourceUrl,
                            baseDir,
                            audioPath,
                            language: project.language,
                            openaiApiKey: keys.openaiApiKey,
                            openaiTranscriptionModel: keys.openaiTranscriptionModel,
                            openaiTranscriptionBaseUrl: keys.openaiTranscriptionBaseUrl,
                            skipYoutubeTranscript: true,
                        }),
                );
            }

            const transcriptWithWords = this.transcript.ensureTranscriptWords(transcriptData);
            transcriptForMetrics = transcriptWithWords;
            await this.metrics.measure(stageTimings, "save_transcript_sec", () =>
                this.transcript.saveTranscript(payload.projectId, transcriptWithWords),
            );

            currentStage = "ANALYZING_CLIPS";
            log("Analisando cortes com IA", { stage: "ANALYZING_CLIPS" });
            await this.metrics.stage(payload.projectId, "ANALYZING_CLIPS", 50);
            const analyzer = new LlmClipAnalyzerService({
                apiKey: keys.llmApiKey ?? undefined,
                baseURL: keys.llmBaseUrl,
                model: keys.llmModel,
                logger: (message) => log(message),
            });
            const feedbackNotes = await this.feedbackProfile
                .buildFeedbackNotes(payload.userId)
                .catch(() => undefined);
            const { clips: rawClips, telemetry: llmTelemetry } =
                await this.metrics.measure(stageTimings, "llm_analyze_sec", () =>
                    analyzer.analyzeTranscript({
                        transcript: transcriptWithWords,
                        clipStyle: project.clipStyle,
                        contentType: project.contentType,
                        language: project.language,
                        preferredDuration: project.preferredClipDuration,
                        maxClips: clipTarget,
                        feedbackNotes,
                        minViralScore: 0,
                        offline: !keys.llmApiKey,
                    }),
                );
            llmTelemetryForMetrics = llmTelemetry;
            rawClipCountForMetrics = rawClips.length;

            let validatedClips = this.metrics.measureSync(stageTimings, "validate_clips_sec", () =>
                this.validation.validate(rawClips, transcriptWithWords, duration!, 70, clipTarget),
            );

            if (!validatedClips.length && rawClips.length > 0) {
                log(
                    `Nenhum corte da IA bateu o piso de score; usando os ${rawClips.length} melhores cortes da IA.`,
                    { stage: "ANALYZING_CLIPS", rawClipCount: rawClips.length },
                );
                validatedClips = this.metrics.measureSync(
                    stageTimings,
                    "validate_clips_relaxed_sec",
                    () => this.validation.validate(rawClips, transcriptWithWords, duration!, 0, clipTarget),
                );
            }

            if (!validatedClips.length) {
                log(
                    `Analisador retornou ${rawClips.length} corte(s), mas nenhum passou na validação. Usando fallback operacional.`,
                    { stage: "ANALYZING_CLIPS", rawClipCount: rawClips.length },
                );
                validatedClips = this.metrics.measureSync(stageTimings, "fallback_clips_sec", () =>
                    this.clips.buildOperationalFallbackClips(
                        transcriptWithWords,
                        project.preferredClipDuration,
                        duration!,
                        clipTarget,
                    ),
                );
            }

            validatedClipCountForMetrics = validatedClips.length;
            if (!validatedClips.length) {
                throw new Error("Nenhum corte válido foi encontrado na transcrição");
            }

            if (transcriptWithWords.quality && !transcriptWithWords.quality.ok) {
                validatedClips = validatedClips.map((clip) => ({
                    ...clip,
                    needs_review: true,
                    reason: `${clip.reason} Transcrição marcada para revisão: ${transcriptWithWords.quality?.reason}.`,
                }));
            }

            currentStage = "SAVING_CLIPS";
            log("Salvando cortes", { stage: "SAVING_CLIPS", clipCount: validatedClips.length });
            await this.metrics.stage(payload.projectId, "SAVING_CLIPS", 60);
            await this.metrics.measure(stageTimings, "save_clips_sec", () =>
                this.clips.persistClips(payload.projectId, validatedClips, log),
            );

            const costPerToken =
                llmTelemetry.totalTokens > 0 ? this.estimateCost(llmTelemetry) : null;
            llmCostForMetrics = costPerToken;
            await this.prisma.project.update({
                where: { id: payload.projectId },
                data: {
                    llmPass1Tokens: llmTelemetry.pass1Tokens || null,
                    llmPass2Tokens: llmTelemetry.pass2Tokens || null,
                    llmPass1Model: llmTelemetry.pass1Model || null,
                    llmPass2Model: llmTelemetry.pass2Model || null,
                    llmCostEstimate: costPerToken,
                },
            });
            log("Telemetria LLM salva", {
                totalTokens: llmTelemetry.totalTokens,
                costEstimate: costPerToken,
                rejectionRate: llmTelemetry.rejectionRate,
            });

            currentStage = "RENDERING";
            log("Renderizando cortes", { stage: "RENDERING" });
            await this.metrics.stage(payload.projectId, "RENDERING", 70);

            const userQuota = await this.prisma.userQuota.findUnique({
                where: { userId: payload.userId },
            });
            const maxRenders = userQuota ? userQuota.maxRendersPerMonth : 20;
            const usedRenders = userQuota ? userQuota.monthlyRenders : 0;
            if (usedRenders + validatedClips.length > maxRenders) {
                throw new Error(
                    `Você possui saldo para renderizar ${maxRenders - usedRenders} clips, mas o projeto gerou ${validatedClips.length}.`,
                );
            }

            const isFreePlan =
                !userQuota || userQuota.plan === "free" || userQuota.plan === "inactive";

            renderSummaryForMetrics = await this.metrics.measure(
                stageTimings,
                "render_total_sec",
                () =>
                    this.render.renderClips(
                        payload.projectId,
                        payload.userId,
                        originalFilePath,
                        transcriptWithWords,
                        {
                            captionTheme: project.captionTheme,
                            renderLayout: project.renderLayout,
                            watermarkText: isFreePlan ? "Made with ViralForge" : undefined,
                        },
                    ),
            );

            const completedClips = await this.prisma.clip.count({
                where: { projectId: payload.projectId, status: "COMPLETED" },
            });
            if (completedClips === 0) {
                throw new Error("Todos os clips falharam na renderização");
            }

            log("Processamento concluído", { stage: "COMPLETED" });
            await this.metrics.stage(payload.projectId, "COMPLETED", 100, "COMPLETED");
            await this.render.registerQuotaMinutes(payload.userId, duration);
            await this.metrics.savePipelineRunMetric({
                projectId: payload.projectId,
                jobId,
                status: "COMPLETED",
                totalSec: this.metrics.elapsedSec(runStartedAt),
                stageTimings,
                videoDurationSec: duration,
                transcript: transcriptForMetrics,
                llmTelemetry: llmTelemetryForMetrics,
                llmCostEstimate: llmCostForMetrics,
                rawClipCount: rawClipCountForMetrics,
                validatedClipCount: validatedClipCountForMetrics,
                renderedClipCount: renderSummaryForMetrics.completed,
                failedRenderCount: renderSummaryForMetrics.failed,
                renderEngines: renderSummaryForMetrics.engines,
                remoteGpuUsed: renderSummaryForMetrics.remoteGpuUsed,
                fallbackUsed: renderSummaryForMetrics.fallbackUsed,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Erro desconhecido no processamento";
            log(`Falha no processamento: ${message}`, { stage: "FAILED" });
            await this.metrics
                .stage(payload.projectId, "FAILED", 100, "FAILED", message)
                .catch((stageError) => {
                    log("Projeto sumiu antes de registrar falha; job descartado", {
                        error:
                            stageError instanceof Error
                                ? stageError.message
                                : String(stageError),
                    });
                });
            await this.metrics.savePipelineRunMetric({
                projectId: payload.projectId,
                jobId,
                status: "FAILED",
                failedStage: currentStage,
                errorMessage: message,
                totalSec: this.metrics.elapsedSec(runStartedAt),
                stageTimings,
                videoDurationSec: duration,
                transcript: transcriptForMetrics,
                llmTelemetry: llmTelemetryForMetrics,
                llmCostEstimate: llmCostForMetrics,
                rawClipCount: rawClipCountForMetrics,
                validatedClipCount: validatedClipCountForMetrics,
                renderedClipCount: renderSummaryForMetrics?.completed ?? null,
                failedRenderCount: renderSummaryForMetrics?.failed ?? null,
                renderEngines: renderSummaryForMetrics?.engines,
                remoteGpuUsed: renderSummaryForMetrics?.remoteGpuUsed ?? null,
                fallbackUsed: renderSummaryForMetrics?.fallbackUsed ?? null,
            });
            throw error;
        }
    }

    private async publishClip(
        payload: Extract<QueueJobPayload, { jobType: "PUBLISH_CLIP" }>,
        jobId: string,
    ) {
        const log = (msg: string, extra?: Record<string, unknown>) =>
            this.logger.log({ msg, jobId, projectId: payload.projectId, clipId: payload.clipId, ...extra });

        log("Iniciando publicação do clip");
        try {
            const clip = await this.prisma.clip.findUniqueOrThrow({ where: { id: payload.clipId } });
            if (!clip.videoPath) throw new Error("Clip não possui arquivo de vídeo");

            if (payload.platform === "YOUTUBE") {
                const result = await this.youtubePublish.publishClip(
                    payload.clipId,
                    payload.socialAccountId,
                    clip.videoPath,
                );
                await this.prisma.publishedClip.updateMany({
                    where: { clipId: payload.clipId, socialAccountId: payload.socialAccountId },
                    data: {
                        status: "PUBLISHED",
                        platformPostId: result.videoId,
                        platformPostUrl: result.url,
                        publishedAt: new Date(),
                    },
                });
            } else if (payload.platform === "TIKTOK") {
                const account = await this.prisma.socialAccount.findUniqueOrThrow({
                    where: { id: payload.socialAccountId },
                });
                if (!account.accessTokenEncrypted) throw new Error("TikTok sem token de acesso");
                const masterSecret = process.env.MASTER_SECRET;
                if (!masterSecret) throw new Error("MASTER_SECRET não configurada");
                const { decryptSecret } = await import("@viralforge/shared");
                const accessToken = decryptSecret(account.accessTokenEncrypted, masterSecret);
                if (!accessToken) throw new Error("Falha ao descriptografar token TikTok");
                const openId = account.platformAccountId;
                if (!openId) throw new Error("TikTok account sem open_id");
                const result = await this.tiktokPublish.publish(
                    clip.videoPath,
                    clip.title,
                    accessToken,
                    openId,
                );
                await this.prisma.publishedClip.updateMany({
                    where: { clipId: payload.clipId, socialAccountId: payload.socialAccountId },
                    data: {
                        status: "PUBLISHED",
                        platformPostId: result.id,
                        platformPostUrl: result.url,
                        publishedAt: new Date(),
                    },
                });
            } else if (payload.platform === "INSTAGRAM") {
                const account = await this.prisma.socialAccount.findUniqueOrThrow({
                    where: { id: payload.socialAccountId },
                });
                if (!account.accessTokenEncrypted) throw new Error("Instagram sem token de acesso");
                const masterSecret = process.env.MASTER_SECRET;
                if (!masterSecret) throw new Error("MASTER_SECRET não configurada");
                const { decryptSecret } = await import("@viralforge/shared");
                const accessToken = decryptSecret(account.accessTokenEncrypted, masterSecret);
                const igAccountId = account.platformAccountId;
                if (!accessToken || !igAccountId) {
                    throw new Error(
                        "Falha ao descriptografar token Instagram ou accountId ausente",
                    );
                }
                const result = await this.instagramPublish.publishReel(
                    clip.videoPath,
                    clip.title,
                    accessToken,
                    igAccountId,
                );
                await this.prisma.publishedClip.updateMany({
                    where: { clipId: payload.clipId, socialAccountId: payload.socialAccountId },
                    data: {
                        status: "PUBLISHED",
                        platformPostId: result.id,
                        platformPostUrl: result.url,
                        publishedAt: new Date(),
                    },
                });
            }

            log("Clip publicado com sucesso");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Falha ao publicar clip";
            log(`Falha na publicação: ${message}`, { stage: "FAILED" });
            await this.prisma.publishedClip.updateMany({
                where: { clipId: payload.clipId, socialAccountId: payload.socialAccountId },
                data: { status: "FAILED", errorMessage: message },
            });
            throw error;
        }
    }

    private async resolveOriginalFile(
        payload: Extract<QueueJobPayload, { jobType?: "PROCESS_PROJECT" }>,
        baseDir: string,
        jobId: string,
    ) {
        const log = (msg: string, extra?: Record<string, unknown>) =>
            this.logger.log({ msg, jobId, projectId: payload.projectId, ...extra });

        if (
            payload.originalFilePath &&
            (await this.ffmpeg.hasVideoStream(payload.originalFilePath))
        ) {
            return payload.originalFilePath;
        }
        if (!payload.sourceUrl) {
            throw new Error("Job sem arquivo original e sem URL de origem");
        }

        log("Fazendo download do YouTube", { stage: "DOWNLOADING_VIDEO" });
        await this.metrics.stage(payload.projectId, "DOWNLOADING_VIDEO", 8);
        const originalFilePath = await this.youtubeDownload.download(
            payload.sourceUrl,
            baseDir,
        );
        await this.prisma.project.update({
            where: { id: payload.projectId },
            data: { originalFilePath },
        });
        return originalFilePath;
    }

    private estimateCost(telemetry: LlmTelemetry): number | null {
        const rate =
            MODEL_COST_PER_1K[telemetry.pass1Model] ??
            MODEL_COST_PER_1K[telemetry.pass2Model] ??
            0.0003;
        return Math.round(telemetry.totalTokens * rate * 1000) / 1000;
    }
}
