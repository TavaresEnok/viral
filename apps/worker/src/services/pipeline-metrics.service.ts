import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { createRedisConnectionConfig } from "@viralforge/shared";
import { Redis } from "ioredis";
import { performance } from "node:perf_hooks";
import type { PipelineMetricDraft } from "../types/pipeline.types.js";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class PipelineMetricsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PipelineMetricsService.name);
    private redisPublisher!: Redis;

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        this.redisPublisher = new Redis({
            ...createRedisConnectionConfig(),
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });
        await this.redisPublisher.connect().catch(() => {});
    }

    async onModuleDestroy() {
        this.redisPublisher.disconnect();
    }

    elapsedSec(startedAt: number): number {
        return Math.round(((performance.now() - startedAt) / 1000) * 1000) / 1000;
    }

    async measure<T>(
        timings: Record<string, number>,
        key: string,
        fn: () => Promise<T>,
    ): Promise<T> {
        const startedAt = performance.now();
        try {
            return await fn();
        } finally {
            timings[key] = this.elapsedSec(startedAt);
        }
    }

    measureSync<T>(timings: Record<string, number>, key: string, fn: () => T): T {
        const startedAt = performance.now();
        try {
            return fn();
        } finally {
            timings[key] = this.elapsedSec(startedAt);
        }
    }

    async savePipelineRunMetric(metric: PipelineMetricDraft): Promise<void> {
        try {
            await this.prisma.pipelineRunMetric.create({
                data: {
                    projectId: metric.projectId,
                    jobId: metric.jobId,
                    status: metric.status,
                    failedStage: metric.failedStage ?? null,
                    errorMessage: metric.errorMessage ?? null,
                    totalSec: metric.totalSec,
                    stageTimings: metric.stageTimings as never,
                    videoDurationSec: metric.videoDurationSec ?? null,
                    transcriptSource: metric.transcript?.source ?? null,
                    transcriptQualityScore: metric.transcript?.quality?.score ?? null,
                    transcriptSegmentCount: metric.transcript?.segments.length ?? null,
                    transcriptWordCount: metric.transcript?.words?.length ?? null,
                    asrProvider: metric.transcript?.remoteAsr?.provider ?? null,
                    asrModel: metric.transcript?.remoteAsr?.model ?? null,
                    asrComputeType: metric.transcript?.remoteAsr?.computeType ?? null,
                    asrDevice: metric.transcript?.remoteAsr?.device ?? null,
                    asrTotalSec: metric.transcript?.remoteAsr?.totalSec ?? null,
                    asrRtf: metric.transcript?.remoteAsr?.rtf ?? null,
                    llmPass1Model: metric.llmTelemetry?.pass1Model ?? null,
                    llmPass2Model: metric.llmTelemetry?.pass2Model ?? null,
                    llmPass1Tokens: metric.llmTelemetry?.pass1Tokens ?? null,
                    llmPass2Tokens: metric.llmTelemetry?.pass2Tokens ?? null,
                    llmTotalTokens: metric.llmTelemetry?.totalTokens ?? null,
                    llmCostEstimate: metric.llmCostEstimate ?? null,
                    pass1CandidateCount: metric.llmTelemetry?.pass1CandidateCount ?? null,
                    pass2ClipCount: metric.llmTelemetry?.pass2ClipCount ?? null,
                    approvedClipCount: metric.llmTelemetry?.approvedClipCount ?? null,
                    rejectionRate: metric.llmTelemetry?.rejectionRate ?? null,
                    rawClipCount: metric.rawClipCount ?? null,
                    validatedClipCount: metric.validatedClipCount ?? null,
                    renderedClipCount: metric.renderedClipCount ?? null,
                    failedRenderCount: metric.failedRenderCount ?? null,
                    remoteGpuUsed: Boolean(metric.remoteGpuUsed),
                    fallbackUsed:
                        Boolean(metric.fallbackUsed) ||
                        Boolean(metric.transcript?.remoteAsr?.fallbackUsed) ||
                        Boolean(metric.failedRenderCount && metric.failedRenderCount > 0),
                    renderEngines: metric.renderEngines ? (metric.renderEngines as never) : undefined,
                },
            });
        } catch (error) {
            this.logger.warn({
                msg: "Falha ao salvar métricas de pipeline",
                projectId: metric.projectId,
                jobId: metric.jobId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async stage(
        projectId: string,
        stage: string,
        progress: number,
        status: "PROCESSING" | "COMPLETED" | "FAILED" = "PROCESSING",
        errorMessage?: string,
    ): Promise<void> {
        const updated = await this.prisma.project.updateMany({
            where: { id: projectId },
            data: {
                status,
                progress,
                errorMessage: errorMessage ?? null,
            },
        });
        if (updated.count === 0) {
            throw new Error(`Projeto ${projectId} não existe mais`);
        }
        await this.upsertProcessingJob(projectId, stage, progress, status, errorMessage);
    }

    async upsertProcessingJob(
        projectId: string,
        stage: string,
        progress: number,
        status: "PROCESSING" | "COMPLETED" | "FAILED",
        errorMessage?: string,
    ): Promise<void> {
        const now = new Date();
        const existing = await this.prisma.processingJob.findFirst({
            where: { projectId, stage },
            select: { id: true },
        });
        const data = {
            status,
            progress,
            errorMessage: errorMessage ?? null,
            ...(status === "PROCESSING"
                ? { startedAt: now, completedAt: null }
                : { completedAt: now }),
        };
        if (existing) {
            await this.prisma.processingJob.update({ where: { id: existing.id }, data });
            return;
        }
        await this.prisma.processingJob.create({ data: { projectId, stage, ...data } });

        await this.redisPublisher
            .publish(`project:${projectId}:updates`, "update")
            .catch(() => {});
    }
}
