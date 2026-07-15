import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { ClipStatus, ProjectStatus } from "@prisma/client";
import { QuotaService } from "../quota/quota.service.js";
import { QueueService } from "../queue/queue.service.js";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import {
    deleteProjectFiles,
    deleteClipFiles,
    safeUnlink,
} from "../common/storage-cleanup.helper.js";
import type { CreateProjectDto, UpdateProjectDto } from "./dto.js";

@Injectable()
export class ProjectsService {
    private readonly logger = new Logger(ProjectsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: QueueService,
        private readonly quotaService: QuotaService,
        private readonly audit: AuditService,
    ) {}

    async list(userId: string) {
        await this.failStaleProjects(userId);
        await this.failStaleClipRenders(userId);
        return this.prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { clips: true } },
                clips: {
                    where: { status: "COMPLETED" },
                    orderBy: [{ finalScore: "desc" }, { viralScore: "desc" }],
                    take: 1,
                },
            },
        });
    }

    async create(userId: string, dto: CreateProjectDto) {
        // Validate project creation quota (counts how many projects exist this month)
        await this.quotaService.ensureCanCreateProject(userId);

        const project = await this.prisma.project.create({
            data: {
                userId,
                title: dto.title.trim(),
                language: dto.language,
                contentType: dto.contentType,
                clipStyle: dto.clipStyle,
                preferredClipDuration: dto.preferredClipDuration,
                renderLayout: dto.renderLayout,
                captionTheme: dto.captionTheme,
                status: ProjectStatus.DRAFT,
            },
        });
        await this.audit.record({
            userId,
            action: "project.create",
            entityType: "project",
            entityId: project.id,
        });
        return project;
    }

    async get(userId: string, id: string) {
        await this.failStaleProjects(userId, id);
        await this.failStaleClipRenders(userId, id);
        const project = await this.prisma.project.findFirst({
            where: { id, userId },
            include: {
                clips: {
                    orderBy: [{ finalScore: "desc" }, { viralScore: "desc" }],
                },
                transcript: true,
            },
        });
        if (!project) {
            throw new NotFoundException("Projeto não encontrado");
        }
        return project;
    }

    async update(userId: string, id: string, dto: UpdateProjectDto) {
        await this.ensureOwner(userId, id);
        return this.prisma.project.update({
            where: { id },
            data: { title: dto.title.trim() },
        });
    }

    async remove(userId: string, id: string) {
        const project = await this.ensureOwner(userId, id);
        const clips = await this.prisma.clip.findMany({
            where: { projectId: id },
        });
        const clipIds = clips.map((clip) => clip.id);

        await Promise.all(clips.map((clip) => deleteClipFiles(clip)));
        await deleteProjectFiles(project);
        await this.prisma.$transaction([
            ...(clipIds.length
                ? [
                      this.prisma.clipFeedback.deleteMany({
                          where: { clipId: { in: clipIds } },
                      }),
                  ]
                : []),
            this.prisma.clip.deleteMany({ where: { projectId: id } }),
            this.prisma.transcript.deleteMany({ where: { projectId: id } }),
            this.prisma.processingJob.deleteMany({ where: { projectId: id } }),
            this.prisma.project.delete({ where: { id } }),
        ]);
        await this.audit.record({
            userId,
            action: "project.delete",
            entityType: "project",
            entityId: id,
            metadata: { clipCount: clips.length },
        });
        return { ok: true };
    }

    async attachUpload(
        userId: string,
        projectId: string,
        originalFilePath: string,
    ) {
        const project = await this.ensureOwner(userId, projectId);
        if (
            project.status !== ProjectStatus.DRAFT &&
            project.status !== ProjectStatus.FAILED
        ) {
            throw new ForbiddenException(
                "Projeto não aceita novo upload neste estado",
            );
        }

        await this.quotaService.ensureCanStartProcessing(userId);

        // Clean up previous upload/audio if replacing the source
        if (project.originalFilePath && project.originalFilePath !== originalFilePath) {
            await safeUnlink(project.originalFilePath).catch(() => {});
        }
        if (project.audioFilePath) {
            await safeUnlink(project.audioFilePath).catch(() => {});
        }

        const updated = await this.prisma.project.update({
            where: { id: projectId },
            data: {
                originalFilePath,
                audioFilePath: null,
                sourceUrl: null,
                status: ProjectStatus.PENDING,
                progress: 5,
                errorMessage: null,
            },
        });

        await this.upsertProcessingJob(
            projectId,
            "UPLOAD_RECEIVED",
            "PENDING",
            5,
        );

        await this.queueService.addVideoProcessingJob({
            projectId,
            userId,
            originalFilePath,
        });
        await this.audit.record({
            userId,
            action: "project.upload",
            entityType: "project",
            entityId: projectId,
        });
        return updated;
    }

    async attachYoutubeUrl(
        userId: string,
        projectId: string,
        youtubeUrl: string,
    ) {
        const project = await this.ensureOwner(userId, projectId);
        if (
            project.status !== ProjectStatus.DRAFT &&
            project.status !== ProjectStatus.FAILED
        ) {
            throw new ForbiddenException(
                "Projeto não aceita nova URL neste estado",
            );
        }

        await this.quotaService.ensureCanStartProcessing(userId);

        // Clean up previous local upload and audio if switching to YouTube source
        if (project.originalFilePath) {
            await safeUnlink(project.originalFilePath).catch(() => {});
        }
        if (project.audioFilePath) {
            await safeUnlink(project.audioFilePath).catch(() => {});
        }

        const normalizedUrl = this.normalizeYoutubeUrl(youtubeUrl);
        const updated = await this.prisma.project.update({
            where: { id: projectId },
            data: {
                sourceUrl: normalizedUrl,
                originalFilePath: null,
                audioFilePath: null,
                status: ProjectStatus.PENDING,
                progress: 5,
                errorMessage: null,
            },
        });

        await this.upsertProcessingJob(
            projectId,
            "YOUTUBE_URL_RECEIVED",
            "PENDING",
            5,
        );

        await this.queueService.addVideoProcessingJob({
            projectId,
            userId,
            sourceUrl: normalizedUrl,
        });
        await this.audit.record({
            userId,
            action: "project.youtube_submit",
            entityType: "project",
            entityId: projectId,
        });
        return updated;
    }

    async retry(userId: string, projectId: string) {
        const project = await this.ensureOwner(userId, projectId);
        if (!project.originalFilePath && !project.sourceUrl) {
            throw new BadRequestException(
                "Projeto não tem vídeo ou URL para reprocessar",
            );
        }

        // Retry does not consume a new project slot — it only validates available minutes
        await this.quotaService.ensureCanStartProcessing(userId);

        // Clean up stale audio before retry (original video is reused)
        if (project.audioFilePath) {
            await safeUnlink(project.audioFilePath).catch(() => {});
        }

        const clips = await this.prisma.clip.findMany({ where: { projectId } });
        await Promise.all(clips.map((clip) => deleteClipFiles(clip)));

        await this.prisma.$transaction([
            this.prisma.clipFeedback.deleteMany({
                where: { clip: { projectId } },
            }),
            this.prisma.clip.deleteMany({ where: { projectId } }),
            this.prisma.transcript.deleteMany({ where: { projectId } }),
            this.prisma.processingJob.deleteMany({ where: { projectId } }),
        ]);

        const updated = await this.prisma.project.update({
            where: { id: projectId },
            data: {
                audioFilePath: null,
                status: ProjectStatus.PENDING,
                progress: 5,
                errorMessage: null,
            },
        });

        await this.upsertProcessingJob(
            projectId,
            "RETRY_REQUESTED",
            "PENDING",
            5,
        );

        this.logger.log({
            msg: "Retry de projeto limpo e re-enfileirado",
            projectId,
        });

        await this.queueService.addVideoProcessingJob({
            projectId,
            userId,
            originalFilePath: project.originalFilePath ?? undefined,
            sourceUrl: project.sourceUrl ?? undefined,
        });

        return updated;
    }

    async ensureOwner(userId: string, projectId: string) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project || project.userId !== userId) {
            throw new NotFoundException("Projeto não encontrado");
        }
        return project;
    }

    normalizeYoutubeUrl(value: string) {
        let url: URL;
        try {
            url = new URL(value);
        } catch {
            throw new BadRequestException("URL inválida");
        }

        const allowedHosts = [
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "youtu.be",
        ];
        if (!allowedHosts.includes(url.hostname)) {
            throw new BadRequestException("Use um link válido do YouTube");
        }

        if (url.hostname === "youtu.be" && url.pathname.length <= 1) {
            throw new BadRequestException("Link do YouTube sem vídeo");
        }
        if (
            url.hostname !== "youtu.be" &&
            !url.searchParams.get("v") &&
            !url.pathname.startsWith("/shorts/")
        ) {
            throw new BadRequestException("Link do YouTube sem vídeo");
        }

        return url.toString();
    }

    private staleClipCutoff() {
        const minutes = Number(process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45);
        return new Date(Date.now() - Math.max(5, minutes) * 60_000);
    }

    private async upsertProcessingJob(
        projectId: string,
        stage: string,
        status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
        progress: number,
        errorMessage?: string,
    ) {
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
                : {}),
            ...(status === "COMPLETED" || status === "FAILED"
                ? { completedAt: now }
                : {}),
        };
        if (existing) {
            await this.prisma.processingJob.update({
                where: { id: existing.id },
                data,
            });
            return;
        }
        await this.prisma.processingJob.create({
            data: {
                projectId,
                stage,
                ...data,
            },
        });
    }

    private staleProjectCutoff() {
        const minutes = Number(
            process.env.PROJECT_PROCESSING_TIMEOUT_MINUTES ?? 180,
        );
        return new Date(Date.now() - Math.max(30, minutes) * 60_000);
    }

    private async failStaleClipRenders(userId: string, projectId?: string) {
        await this.prisma.clip.updateMany({
            where: {
                status: ClipStatus.RENDERING,
                updatedAt: { lt: this.staleClipCutoff() },
                project: {
                    userId,
                    ...(projectId ? { id: projectId } : {}),
                },
            },
            data: {
                status: ClipStatus.FAILED,
                errorMessage: `Render excedeu ${process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45} minutos e foi marcado como falho automaticamente.`,
            },
        });
    }

    private async failStaleProjects(userId: string, projectId?: string) {
        await this.prisma.project.updateMany({
            where: {
                userId,
                ...(projectId ? { id: projectId } : {}),
                status: {
                    in: [ProjectStatus.PENDING, ProjectStatus.PROCESSING],
                },
                updatedAt: { lt: this.staleProjectCutoff() },
            },
            data: {
                status: ProjectStatus.FAILED,
                progress: 100,
                errorMessage: `Processamento excedeu ${process.env.PROJECT_PROCESSING_TIMEOUT_MINUTES ?? 180} minutos e foi marcado como falho automaticamente.`,
            },
        });
    }
}
