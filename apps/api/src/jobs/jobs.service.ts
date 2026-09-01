import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClipStatus, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async status(userId: string, projectId: string) {
    await this.failStaleProject(userId, projectId);
    await this.failStaleClipRenders(userId, projectId);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { jobs: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    return {
      projectId,
      status: project.status,
      progress: project.progress,
      errorMessage: project.errorMessage,
      job: project.jobs[0] ?? null,
    };
  }

  async createSseTicket(userId: string, projectId: string): Promise<{ ticket: string; expiresAt: number }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');

    const payload = { sub: userId, projectId, type: 'sse-ticket' };
    const ticket = await this.jwtService.signAsync(payload, { expiresIn: '90s' });
    return { ticket, expiresAt: Date.now() + 90_000 };
  }

  private staleClipCutoff() {
    const minutes = Number(process.env.CLIP_RENDER_TIMEOUT_MINUTES ?? 45);
    return new Date(Date.now() - Math.max(5, minutes) * 60_000);
  }

  private staleProjectCutoff() {
    const minutes = Number(process.env.PROJECT_PROCESSING_TIMEOUT_MINUTES ?? 180);
    return new Date(Date.now() - Math.max(30, minutes) * 60_000);
  }

  private async failStaleClipRenders(userId: string, projectId: string) {
    await this.prisma.clip.updateMany({
      where: {
        projectId,
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

  private async failStaleProject(userId: string, projectId: string) {
    await this.prisma.project.updateMany({
      where: {
        id: projectId,
        userId,
        status: { in: [ProjectStatus.PENDING, ProjectStatus.PROCESSING] },
        updatedAt: { lt: this.staleProjectCutoff() },
      },
      data: {
        status: ProjectStatus.FAILED,
        errorMessage: `Processamento excedeu ${process.env.PROJECT_PROCESSING_TIMEOUT_MINUTES ?? 180} minutos e foi marcado como falho automaticamente.`,
      },
    });
  }
}
