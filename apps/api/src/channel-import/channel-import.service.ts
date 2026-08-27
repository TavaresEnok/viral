import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { QuotaService } from '../quota/quota.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateChannelImportDto, ImportSelectedVideosDto } from './dto.js';

interface ChannelVideo {
  url: string;
  title: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

@Injectable()
export class ChannelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly quota: QuotaService,
    private readonly audit: AuditService,
  ) {}

  async createRequest(userId: string, dto: CreateChannelImportDto) {
    const request = await this.prisma.channelImportRequest.create({
      data: { userId, platform: dto.platform, channelUrl: dto.channelUrl, status: 'PENDING' },
    });
    await this.queue.addListChannelVideosJob({ jobType: 'LIST_CHANNEL_VIDEOS', userId, requestId: request.id });
    await this.audit.record({
      userId,
      action: 'channel_import.request',
      entityType: 'channel_import_request',
      entityId: request.id,
      metadata: { platform: dto.platform },
    });
    return request;
  }

  async listRequests(userId: string) {
    return this.prisma.channelImportRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(userId: string, id: string) {
    const request = await this.prisma.channelImportRequest.findUnique({ where: { id } });
    if (!request || request.userId !== userId) {
      throw new NotFoundException('Solicitação de importação não encontrada');
    }
    return request;
  }

  /**
   * Busca a próxima página de vídeos do mesmo canal, acrescentando ao que já
   * foi listado. O worker usa o total já salvo como offset.
   */
  async loadMore(userId: string, id: string) {
    const request = await this.getRequest(userId, id);
    if (request.status !== 'READY' || !request.hasMore) {
      throw new ForbiddenException('Não há mais vídeos para carregar desta listagem');
    }

    await this.prisma.channelImportRequest.update({
      where: { id },
      data: { status: 'LISTING' },
    });
    await this.queue.addListChannelVideosJob({ jobType: 'LIST_CHANNEL_VIDEOS', userId, requestId: id });
    return { queued: true };
  }

  /**
   * Cria um Project normal (mesmo caminho de "colar URL do YouTube") para cada
   * vídeo selecionado da listagem, e enfileira o processamento padrão. Para na
   * primeira vez que a quota de projetos esgotar, retornando o que já foi
   * importado — melhor que falhar tudo depois de já ter criado alguns.
   */
  async importSelected(userId: string, requestId: string, dto: ImportSelectedVideosDto) {
    const request = await this.getRequest(userId, requestId);
    if (request.status !== 'READY') {
      throw new ForbiddenException('A listagem deste canal ainda não está pronta');
    }

    const videos = (request.videosJson as unknown as ChannelVideo[] | null) ?? [];
    const videoByUrl = new Map(videos.map((video) => [video.url, video]));
    const selected = dto.selectedUrls.filter((url) => videoByUrl.has(url));

    if (!selected.length) {
      throw new BadRequestException('Nenhuma das URLs selecionadas pertence a esta listagem');
    }

    const importedProjectIds: string[] = [];
    let quotaExceededAt: number | null = null;

    for (const [index, url] of selected.entries()) {
      try {
        await this.quota.ensureCanCreateProject(userId);
      } catch (error) {
        quotaExceededAt = index;
        break;
      }

      const title = (videoByUrl.get(url)?.title ?? 'Vídeo importado').slice(0, 120);
      const project = await this.prisma.project.create({
        data: {
          userId,
          title,
          language: dto.language,
          contentType: dto.contentType,
          clipStyle: dto.clipStyle,
          preferredClipDuration: dto.preferredClipDuration,
          renderLayout: dto.renderLayout,
          captionTheme: dto.captionTheme,
          status: 'PENDING',
          progress: 5,
          sourceUrl: url,
        },
      });
      await this.queue.addVideoProcessingJob({ projectId: project.id, userId, sourceUrl: url });
      importedProjectIds.push(project.id);
    }

    await this.audit.record({
      userId,
      action: 'channel_import.import_selected',
      entityType: 'channel_import_request',
      entityId: requestId,
      metadata: { imported: importedProjectIds.length, requested: selected.length },
    });

    return {
      imported: importedProjectIds.length,
      requested: selected.length,
      projectIds: importedProjectIds,
      quotaExceeded: quotaExceededAt !== null,
    };
  }
}
