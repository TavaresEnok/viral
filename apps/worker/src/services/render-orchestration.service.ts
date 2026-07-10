import { Injectable, Logger } from "@nestjs/common";
import type { WordSegment } from "@viralforge/render-engine";
import type { QueueJobPayload } from "@viralforge/shared";
import { existsSync } from "node:fs";
import { cpus } from "node:os";
import { resolve } from "node:path";
import { CircuitBreaker } from "../utils/circuit-breaker.js";
import { positiveInt, type RenderClipsSummary, type TranscriptWithMetadata } from "../types/pipeline.types.js";
import { PipelineMetricsService } from "./pipeline-metrics.service.js";
import { PrismaService } from "./prisma.service.js";
import { RenderingService } from "./rendering.service.js";
import { YoutubeDownloadService } from "./youtube-download.service.js";

function defaultRenderClipConcurrency() {
    if (process.env.RENDER_ENGINE === "remotion") return 1;
    return Math.max(2, Math.min(5, Math.floor(cpus().length * 0.5)));
}

@Injectable()
export class RenderOrchestrationService {
    private readonly logger = new Logger(RenderOrchestrationService.name);
    private readonly remoteRenderCircuit = new CircuitBreaker("remote-render", {
        failureThreshold: 3,
        recoveryMs: 120_000,
    });

    constructor(
        private readonly prisma: PrismaService,
        private readonly rendering: RenderingService,
        private readonly metrics: PipelineMetricsService,
        private readonly youtube: YoutubeDownloadService,
    ) {}

    async renderSingleClip(
        payload: Extract<QueueJobPayload, { jobType: "RENDER_CLIP" }>,
        jobId: string,
    ): Promise<void> {
        const log = (msg: string, extra?: Record<string, unknown>) =>
            this.logger.log({ msg, jobId, projectId: payload.projectId, clipId: payload.clipId, ...extra });

        log("Iniciando renderização de clip");
        const clip = await this.prisma.clip.findFirstOrThrow({
            where: { id: payload.clipId },
            include: { project: { include: { transcript: true } } },
        });

        const originalFilePath = await this.ensureOriginalFile(clip.project, log);

        await this.prisma.clip.update({ where: { id: clip.id }, data: { status: "RENDERING" } });

        try {
            const segments = clip.project.transcript?.segmentsJson
                ? (JSON.parse(JSON.stringify(clip.project.transcript.segmentsJson)) as Array<{
                      start: number;
                      end: number;
                      text: string;
                  }>)
                : [];
            const words = clip.project.transcript?.wordsJson
                ? (JSON.parse(JSON.stringify(clip.project.transcript.wordsJson)) as WordSegment[])
                : undefined;
            const paths = await this.rendering.renderClip(
                originalFilePath,
                clip,
                segments,
                {
                    captionTheme: clip.captionTheme ?? clip.project.captionTheme,
                    renderLayout: clip.renderLayout ?? clip.project.renderLayout,
                    words,
                    previewSeconds: payload.previewSeconds,
                    autoOverlays: payload.autoOverlays,
                },
            );
            const { smartCrop, ...renderedFields } = paths;
            await this.prisma.clip.update({
                where: { id: clip.id },
                data: {
                    ...renderedFields,
                    faceTrackJson: smartCrop
                        ? { cx: smartCrop.cx, cy: smartCrop.cy, coverageRatio: smartCrop.coverageRatio }
                        : undefined,
                    status: "COMPLETED",
                    errorMessage: null,
                },
            });
            await this.registerQuotaRender(payload.userId);
            await this.metrics.upsertProcessingJob(
                payload.projectId,
                "CLIP_RENDERED",
                clip.project.progress,
                "COMPLETED",
            );
            log("Renderização concluída");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Falha ao re-renderizar clip";
            log(`Falha na renderização: ${message}`, { stage: "FAILED" });
            await this.prisma.clip.update({
                where: { id: clip.id },
                data: { status: "FAILED", errorMessage: message },
            });
            await this.metrics.upsertProcessingJob(
                payload.projectId,
                "CLIP_RENDER_FAILED",
                clip.project.progress,
                "FAILED",
                message,
            );
            throw error;
        }
    }

    /**
     * Garante que o vídeo original existe no disco. O janitor de retenção
     * apaga originais antigos de projetos com sourceUrl; aqui o arquivo é
     * re-baixado sob demanda quando o usuário pede um novo render.
     */
    private async ensureOriginalFile(
        project: { id: string; userId: string; originalFilePath: string | null; sourceUrl: string | null },
        log: (msg: string, extra?: Record<string, unknown>) => void,
    ): Promise<string> {
        if (project.originalFilePath && existsSync(project.originalFilePath)) {
            return project.originalFilePath;
        }

        if (!project.sourceUrl) {
            throw new Error("Projeto sem arquivo de vídeo original");
        }

        const repoRoot = process.cwd().endsWith("/apps/worker") ? resolve(process.cwd(), "../..") : process.cwd();
        const baseDir = resolve(
            repoRoot,
            process.env.STORAGE_ROOT ?? "storage/uploads",
            project.userId.replace(/[^a-zA-Z0-9_-]/g, ""),
            project.id.replace(/[^a-zA-Z0-9_-]/g, ""),
        );

        log("Original ausente (retenção); re-baixando da sourceUrl para render");
        const downloadedPath = await this.youtube.download(project.sourceUrl, baseDir);
        await this.prisma.project.update({
            where: { id: project.id },
            data: { originalFilePath: downloadedPath },
        });
        return downloadedPath;
    }

    async renderClips(
        projectId: string,
        userId: string,
        originalFilePath: string,
        transcript: TranscriptWithMetadata,
        options: Parameters<RenderingService["renderClip"]>[3],
    ): Promise<RenderClipsSummary> {
        const clips = await this.prisma.clip.findMany({
            where: { projectId },
            orderBy: [{ finalScore: "desc" }, { viralScore: "desc" }],
        });
        const batchSize = positiveInt(
            process.env.RENDER_CLIP_CONCURRENCY,
            defaultRenderClipConcurrency(),
        );
        this.logger.log({
            msg: `Renderizando ${clips.length} clip(s) com concurrency=${batchSize}`,
            projectId,
            clipCount: clips.length,
            batchSize,
        });
        let remoteMediaId: string | null = null;
        try {
            remoteMediaId = await this.remoteRenderCircuit.call(() =>
                this.rendering.prepareRemoteInput(originalFilePath),
            );
        } catch {
            this.logger.warn({ msg: "Remote render circuit OPEN — usando renderização local", projectId });
        }
        const disableRemote = process.env.REMOTE_RENDER_ENABLED === "true" && !remoteMediaId;
        const summary: RenderClipsSummary = {
            completed: 0,
            failed: 0,
            engines: {},
            remoteGpuUsed: false,
            fallbackUsed: disableRemote,
        };

        // Progresso por corte concluído (não por lote): a barra se move a cada
        // clip que termina, em vez de pular só quando um lote inteiro fecha —
        // antes parecia travada em 70% durante todo o render.
        let processed = 0;
        const emitProgress = async () => {
            processed += 1;
            const progress = Math.min(95, 70 + Math.round((processed / clips.length) * 25));
            await this.metrics
                .stage(projectId, "RENDERING", progress)
                .catch(() => undefined);
        };

        try {
            for (let i = 0; i < clips.length; i += batchSize) {
                const batch = clips.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(async (clip) => {
                        try {
                            await this.prisma.clip.update({
                                where: { id: clip.id },
                                data: { status: "RENDERING" },
                            });
                            const paths = await this.rendering.renderClip(
                                originalFilePath,
                                clip,
                                transcript.segments,
                                { ...options, words: transcript.words, remoteMediaId, disableRemote },
                            );
                            const engine = paths.renderEngine ?? "unknown";
                            summary.completed += 1;
                            summary.engines[engine] = (summary.engines[engine] ?? 0) + 1;
                            if (
                                paths.smartCrop ||
                                engine.includes("remote") ||
                                engine.includes("node") ||
                                engine.includes("nvenc")
                            ) {
                                summary.remoteGpuUsed = true;
                            }
                            const { smartCrop, ...renderedFields } = paths;
                            await this.prisma.clip.update({
                                where: { id: clip.id },
                                data: {
                                    ...renderedFields,
                                    faceTrackJson: smartCrop
                                        ? { cx: smartCrop.cx, cy: smartCrop.cy, coverageRatio: smartCrop.coverageRatio }
                                        : undefined,
                                    status: "COMPLETED",
                                },
                            });
                            await this.registerQuotaRender(userId);
                        } catch (error) {
                            const message =
                                error instanceof Error ? error.message : "Falha ao renderizar clip";
                            summary.failed += 1;
                            this.logger.error({
                                msg: "Falha ao renderizar clip",
                                projectId,
                                clipId: clip.id,
                                error: message,
                            });
                            await this.prisma.clip.update({
                                where: { id: clip.id },
                                data: { status: "FAILED", errorMessage: message },
                            });
                        } finally {
                            await emitProgress();
                        }
                    }),
                );
            }
        } finally {
            await this.rendering.releaseRemoteInput(remoteMediaId);
        }

        return summary;
    }

    async registerQuotaRender(userId: string): Promise<void> {
        const existing = await this.prisma.userQuota.findUnique({ where: { userId } });
        if (existing) {
            await this.prisma.userQuota.update({
                where: { userId },
                data: { monthlyRenders: { increment: 1 } },
            });
        } else {
            await this.prisma.userQuota.create({
                data: {
                    userId,
                    plan: "free",
                    monthlyRenders: 1,
                    maxProjectMinutesPerMonth: 60,
                    maxRendersPerMonth: 20,
                    maxProjectsPerMonth: 5,
                },
            });
        }
    }

    async registerQuotaMinutes(userId: string, durationSeconds: number): Promise<void> {
        const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
        const existing = await this.prisma.userQuota.findUnique({ where: { userId } });
        if (existing) {
            await this.prisma.userQuota.update({
                where: { userId },
                data: { monthlyProjectMinutes: { increment: minutes } },
            });
        } else {
            await this.prisma.userQuota.create({
                data: {
                    userId,
                    plan: "free",
                    monthlyProjectMinutes: minutes,
                    maxProjectMinutesPerMonth: 60,
                    maxRendersPerMonth: 20,
                    maxProjectsPerMonth: 5,
                },
            });
        }
    }
}
