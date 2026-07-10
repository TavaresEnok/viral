import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClipStatus } from '@prisma/client';
import { QuotaService } from '../quota/quota.service.js';
import { QueueService } from '../queue/queue.service.js';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { deleteClipFiles } from '../common/storage-cleanup.helper.js';
import type { CreateClipFeedbackDto, RenderClipDto, UpdateClipTimingDto, UpdateSubtitleSegmentsDto } from './dto.js';

@Injectable()
export class ClipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly quotaService: QuotaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.failStaleClipRenders(userId, projectId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { clips: { orderBy: [{ finalScore: 'desc' }, { viralScore: 'desc' }] } },
    });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }
    return project.clips;
  }

  async getOwnedClip(userId: string, clipId: string) {
    await this.failStaleClipRenders(userId, undefined, clipId);
    const clip = await this.prisma.clip.findFirst({
      where: { id: clipId, project: { userId } },
    });
    if (!clip) {
      throw new NotFoundException('Clip não encontrado');
    }
    return clip;
  }

  async remove(userId: string, clipId: string) {
    const clip = await this.getOwnedClip(userId, clipId);
    await deleteClipFiles(clip);
    await this.prisma.$transaction([
      this.prisma.clipFeedback.deleteMany({ where: { clipId: clip.id } }),
      this.prisma.clip.delete({ where: { id: clip.id } }),
    ]);
    await this.audit.record({ userId, action: 'clip.delete', entityType: 'clip', entityId: clip.id, metadata: { projectId: clip.projectId } });
    return { ok: true };
  }

  async feedback(userId: string, clipId: string, dto: CreateClipFeedbackDto) {
    await this.getOwnedClip(userId, clipId);

    return this.prisma.clipFeedback.upsert({
      where: { clipId_userId: { clipId, userId } },
      update: {
        reason: dto.reason,
        note: dto.note?.trim() || null,
      },
      create: {
        clipId,
        userId,
        reason: dto.reason,
        note: dto.note?.trim() || null,
      },
    });
  }

  async updateTiming(userId: string, clipId: string, dto: UpdateClipTimingDto) {
    const clip = await this.getOwnedClip(userId, clipId);
    const duration = Math.round(dto.end - dto.start);
    if (dto.end <= dto.start || duration < 5 || duration > 90) {
      throw new BadRequestException('O recorte precisa ter entre 5 e 90 segundos.');
    }

    const project = await this.prisma.project.findFirst({ where: { id: clip.projectId, userId } });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }
    if (project.durationSeconds && dto.end > project.durationSeconds) {
      throw new BadRequestException('O fim do recorte passa da duração do vídeo.');
    }

    return this.prisma.clip.update({
      where: { id: clipId },
      data: {
        start: dto.start,
        end: dto.end,
        duration,
        ...(dto.renderLayout && { renderLayout: dto.renderLayout }),
        ...(dto.captionTheme && { captionTheme: dto.captionTheme }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.suggestedCaptionTitle !== undefined && { suggestedCaptionTitle: dto.suggestedCaptionTitle }),
      },
    });
  }

  async render(userId: string, clipId: string, dto: RenderClipDto) {
    const clip = await this.getOwnedClip(userId, clipId);

    await this.quotaService.ensureCanRender(userId);

    const updated = await this.updateTiming(userId, clipId, {
      start: dto.start ?? clip.start,
      end: dto.end ?? clip.end,
      renderLayout: dto.renderLayout,
      captionTheme: dto.captionTheme,
    });

    await this.prisma.clip.update({
      where: { id: clipId },
      data: { status: 'RENDERING', errorMessage: null },
    });

    await this.queueService.addClipRenderJob({
      jobType: 'RENDER_CLIP',
      projectId: updated.projectId,
      userId,
      clipId,
      previewSeconds: dto.previewSeconds ? Math.min(10, dto.previewSeconds) : undefined,
      autoOverlays: dto.autoOverlays,
    });

    return this.getOwnedClip(userId, clipId);
  }

  async getSegments(userId: string, clipId: string) {
    const clip = await this.prisma.clip.findFirst({
      where: { id: clipId, project: { userId } },
      include: { project: { include: { transcript: true } } },
    });
    if (!clip) throw new NotFoundException('Clip não encontrado');

    // If user already saved custom segments, return those
    if (clip.subtitleSegmentsJson) {
      return { segments: clip.subtitleSegmentsJson as Array<{ start: number; end: number; text: string }>, custom: true };
    }

    // Otherwise filter from global transcript
    if (!clip.project.transcript?.segmentsJson) {
      return { segments: [], custom: false };
    }
    const allSegments = clip.project.transcript.segmentsJson as Array<{ start: number; end: number; text: string }>;
    const filtered = allSegments.filter((s) => s.end > clip.start && s.start < clip.end);
    return { segments: filtered, custom: false };
  }

  async updateSegments(userId: string, clipId: string, dto: UpdateSubtitleSegmentsDto) {
    const clip = await this.prisma.clip.findFirst({
      where: { id: clipId, project: { userId } },
    });
    if (!clip) throw new NotFoundException('Clip não encontrado');

    // Basic validation
    if (!Array.isArray(dto.segments)) throw new BadRequestException('segments deve ser um array');
    for (const s of dto.segments) {
      if (typeof s.start !== 'number' || typeof s.end !== 'number' || typeof s.text !== 'string') {
        throw new BadRequestException('Cada segment precisa de start, end e text');
      }
      if (s.end <= s.start) throw new BadRequestException('end deve ser maior que start');
    }

    await this.prisma.clip.update({
      where: { id: clipId },
      data: { subtitleSegmentsJson: dto.segments as never },
    });
    return { ok: true, count: dto.segments.length };
  }

  async resetSegments(userId: string, clipId: string) {
    const clip = await this.prisma.clip.findFirst({
      where: { id: clipId, project: { userId } },
    });
    if (!clip) throw new NotFoundException('Clip não encontrado');
    await this.prisma.clip.update({
      where: { id: clipId },
      data: { subtitleSegmentsJson: { set: null } as never },
    });
    return { ok: true };
  }

  private staleClipCutoff() {
    const minutes = Number(process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45);
    return new Date(Date.now() - Math.max(5, minutes) * 60_000);
  }

  private async failStaleClipRenders(userId: string, projectId?: string, clipId?: string) {
    await this.prisma.clip.updateMany({
      where: {
        ...(clipId ? { id: clipId } : {}),
        ...(projectId ? { projectId } : {}),
        status: ClipStatus.RENDERING,
        updatedAt: { lt: this.staleClipCutoff() },
        project: { userId },
      },
      data: {
        status: ClipStatus.FAILED,
        errorMessage: `Render excedeu ${process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45} minutos e foi marcado como falho automaticamente.`,
      },
    });
  }
}
