import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClipStatus, ProjectStatus } from '@prisma/client';
import { stat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaService } from './prisma.service.js';
import { Queue } from 'bullmq';
import type { QueueJobPayload } from '@viralforge/shared';
import { REDIS_CONFIG, VIDEO_PROCESSING_QUEUE } from '@viralforge/shared';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly queue: Queue<QueueJobPayload>;

  constructor(private readonly prisma: PrismaService) {
    this.queue = new Queue(VIDEO_PROCESSING_QUEUE, {
      connection: REDIS_CONFIG,
    });
  }

  async onModuleInit() {
    await this.failStaleProcessing().catch((error) => {
      this.logger.warn({
        msg: 'Falha ao executar watchdog de stale jobs na inicialização',
        error: error instanceof Error ? error.message : String(error),
      });
    });
    await this.recoverOrFailOrphanProjects().catch((error) => {
      this.logger.warn({
        msg: 'Falha ao executar watchdog de órfãos na inicialização',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledPublishes() {
    const dueAt = new Date();
    const due = await this.prisma.publishedClip.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: dueAt },
      },
      include: {
        clip: { select: { projectId: true } },
        socialAccount: { select: { userId: true, platform: true } },
      },
    });

    for (const item of due) {
      // Claim atômico: se outra instância/tick já pegou este item, pula.
      // Revalida scheduledAt para não publicar um item que foi reagendado
      // entre o findMany e este claim.
      const claimed = await this.prisma.publishedClip.updateMany({
        where: { id: item.id, status: 'PENDING', scheduledAt: { lte: dueAt } },
        data: { status: 'PUBLISHING' },
      });
      if (claimed.count === 0) continue;

      this.logger.log({ msg: 'Executando publicação agendada', publishedId: item.id, clipId: item.clipId });

      await this.queue.add('publish-clip', {
        jobType: 'PUBLISH_CLIP',
        projectId: item.clip.projectId,
        userId: item.socialAccount.userId,
        clipId: item.clipId,
        socialAccountId: item.socialAccountId,
        platform: item.socialAccount.platform,
      });
    }

    if (due.length > 0) {
      this.logger.log({ msg: `Enfileirados ${due.length} clips agendados` });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async failStaleProcessing() {
    const staleProjects = await this.prisma.project.updateMany({
      where: {
        status: { in: [ProjectStatus.PENDING, ProjectStatus.PROCESSING] },
        updatedAt: { lt: this.staleProjectCutoff() },
      },
      data: {
        status: ProjectStatus.FAILED,
        progress: 100,
        errorMessage: `Processamento excedeu ${process.env.PROJECT_PROCESSING_TIMEOUT_MINUTES ?? 180} minutos e foi marcado como falho automaticamente.`,
      },
    });
    const staleClips = await this.prisma.clip.updateMany({
      where: {
        status: ClipStatus.RENDERING,
        updatedAt: { lt: this.staleClipCutoff() },
      },
      data: {
        status: ClipStatus.FAILED,
        errorMessage: `Render excedeu ${process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45} minutos e foi marcado como falho automaticamente.`,
      },
    });
    const stalePublishes = await this.prisma.publishedClip.updateMany({
      where: {
        status: 'PUBLISHING',
        updatedAt: { lt: this.stalePublishCutoff() },
      },
      data: {
        status: 'FAILED',
        errorMessage: `Publicação excedeu ${process.env.PUBLISH_TIMEOUT_MINUTES ?? 15} minutos sem concluir e foi marcada como falha automaticamente. Tente publicar novamente.`,
      },
    });
    if (staleProjects.count > 0 || staleClips.count > 0 || stalePublishes.count > 0) {
      this.logger.warn({
        msg: 'Watchdog marcou itens stale como FAILED',
        staleProjects: staleProjects.count,
        staleClips: staleClips.count,
        stalePublishes: stalePublishes.count,
      });
    }
  }

  /**
   * Retenção de storage: apaga o vídeo original (e o audio.mp3 derivado) de
   * projetos COMPLETED/FAILED antigos que têm sourceUrl — o render re-baixa
   * sob demanda se o usuário pedir um novo render. Uploads diretos (sem
   * sourceUrl) nunca são tocados: são irrecuperáveis.
   * STORAGE_RETENTION_DAYS=0 desativa; padrão 14 dias.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldOriginals() {
    const days = Number(process.env.STORAGE_RETENTION_DAYS ?? 14);
    if (!Number.isFinite(days) || days <= 0) return;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.COMPLETED, ProjectStatus.FAILED] },
        updatedAt: { lt: cutoff },
        sourceUrl: { not: null },
        originalFilePath: { not: null },
      },
      select: { id: true, originalFilePath: true },
      take: 500,
    });
    if (!candidates.length) return;

    let removed = 0;
    let freedBytes = 0;
    for (const project of candidates) {
      const originalPath = project.originalFilePath!;
      try {
        const fileStat = await stat(originalPath);
        await unlink(originalPath);
        freedBytes += fileStat.size;
        removed += 1;
      } catch {
        // Arquivo já não existe; só sincroniza o banco abaixo.
      }
      await unlink(resolve(dirname(originalPath), 'audio.mp3')).catch(() => undefined);
      await this.prisma.project.update({
        where: { id: project.id },
        data: { originalFilePath: null },
      });
    }

    this.logger.log({
      msg: 'Janitor de storage executado',
      projects: candidates.length,
      filesRemoved: removed,
      freedMb: Math.round(freedBytes / 1024 / 1024),
      retentionDays: days,
    });
  }

  /**
   * AuditLog cresce sem limite (uma linha por login/ação). Mantém a janela
   * exigida por auditoria e descarta o resto. AUDIT_RETENTION_DAYS=0 desativa.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldAuditLogs() {
    const days = Number(process.env.AUDIT_RETENTION_DAYS ?? 180);
    if (!Number.isFinite(days) || days <= 0) return;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (deleted.count > 0) {
      this.logger.log({ msg: 'Janitor de AuditLog executado', removed: deleted.count, retentionDays: days });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverOrFailOrphanProjects() {
    const candidates = await this.prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.PENDING, ProjectStatus.PROCESSING] },
        updatedAt: { lt: this.orphanProjectCutoff() },
      },
      select: {
        id: true,
        userId: true,
        sourceUrl: true,
        originalFilePath: true,
        progress: true,
      },
      take: 200,
    });

    if (candidates.length === 0) return;

    const [waitingJobs, activeJobs, delayedJobs] = await Promise.all([
      this.queue.getJobs(['waiting'], 0, -1, true),
      this.queue.getJobs(['active'], 0, -1, true),
      this.queue.getJobs(['delayed'], 0, -1, true),
    ]);

    const queuedProjectIds = new Set<string>();
    for (const job of [...waitingJobs, ...activeJobs, ...delayedJobs]) {
      const data = job.data as QueueJobPayload | undefined;
      if (!data || !('projectId' in data) || !data.projectId) continue;
      if (data.jobType && data.jobType !== 'PROCESS_PROJECT') continue;
      queuedProjectIds.add(data.projectId);
    }

    let autoRecovered = 0;
    let autoFailed = 0;

    for (const project of candidates) {
      if (queuedProjectIds.has(project.id)) continue;

      const retriedBefore = await this.prisma.processingJob.findFirst({
        where: { projectId: project.id, stage: 'AUTO_REQUEUE_ORPHAN' },
        select: { id: true },
      });

      if (!retriedBefore && (project.sourceUrl || project.originalFilePath)) {
        const payload: Extract<QueueJobPayload, { jobType?: 'PROCESS_PROJECT' }> = {
          jobType: 'PROCESS_PROJECT',
          projectId: project.id,
          userId: project.userId,
          ...(project.sourceUrl ? { sourceUrl: project.sourceUrl } : {}),
          ...(project.originalFilePath ? { originalFilePath: project.originalFilePath } : {}),
        };

        await this.prisma.processingJob.create({
          data: {
            projectId: project.id,
            stage: 'AUTO_REQUEUE_ORPHAN',
            status: 'PROCESSING',
            progress: Math.max(5, project.progress),
          },
        });

        await this.queue.add('process-video', payload, {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
          // Use a non-fixed id to guarantee rescue enqueue.
          jobId: `recover:${project.id}:${Date.now()}`,
        });
        autoRecovered += 1;
        continue;
      }

      await this.prisma.project.update({
        where: { id: project.id },
        data: {
          status: ProjectStatus.FAILED,
          progress: 100,
          errorMessage:
            'Projeto ficou órfão (sem job ativo em fila) e foi encerrado automaticamente. Tente reprocessar.',
        },
      });
      await this.prisma.processingJob.create({
        data: {
          projectId: project.id,
          stage: 'AUTO_FAIL_ORPHAN',
          status: 'FAILED',
          progress: 100,
          errorMessage:
            'Projeto ficou órfão (sem job ativo em fila) após tentativa automática de recuperação.',
          completedAt: new Date(),
        },
      });
      autoFailed += 1;
    }

    if (autoRecovered > 0 || autoFailed > 0) {
      this.logger.warn({
        msg: 'Watchdog de órfãos executado',
        scanned: candidates.length,
        autoRecovered,
        autoFailed,
      });
    }
  }

  private staleProjectCutoff() {
    const minutes = Number(process.env.PROJECT_PROCESSING_TIMEOUT_MINUTES ?? 180);
    return new Date(Date.now() - Math.max(30, minutes) * 60_000);
  }

  private staleClipCutoff() {
    const minutes = Number(process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45);
    return new Date(Date.now() - Math.max(5, minutes) * 60_000);
  }

  private stalePublishCutoff() {
    const minutes = Number(process.env.PUBLISH_TIMEOUT_MINUTES ?? 15);
    return new Date(Date.now() - Math.max(5, minutes) * 60_000);
  }

  private orphanProjectCutoff() {
    const minutes = Number(process.env.ORPHAN_PROJECT_GRACE_MINUTES ?? 10);
    return new Date(Date.now() - Math.max(3, minutes) * 60_000);
  }
}
