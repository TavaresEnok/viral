import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Delete, Body, Param, Headers, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IsUrl } from 'class-validator';
import { PublicApiService } from './public-api.service.js';
import { PrismaService } from '../prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CreateProjectDto } from '../projects/dto.js';

class CreateApiProjectDto extends CreateProjectDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  sourceUrl!: string;
}

@ApiTags('public-api')
@Controller('api/v1')
export class PublicApiController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async authenticate(apiKey: string | undefined): Promise<string> {
    if (!apiKey) throw new UnauthorizedException('x-api-key header é obrigatório');
    return this.publicApiService.validateApiKey(apiKey);
  }

  @Get('projects')
  async listProjects(@Headers('x-api-key') apiKey: string) {
    const userId = await this.authenticate(apiKey);
    const projects = await this.prisma.project.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, createdAt: true, durationSeconds: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { projects };
  }

  @Post('projects')
  async createProject(@Headers('x-api-key') apiKey: string, @Body() dto: CreateApiProjectDto) {
    const userId = await this.authenticate(apiKey);
    const normalizedUrl = this.projectsService.normalizeYoutubeUrl(dto.sourceUrl);
    const project = await this.projectsService.create(userId, dto);
    const processing = await this.projectsService.attachYoutubeUrl(userId, project.id, normalizedUrl);
    return {
      project: {
        id: processing.id,
        title: processing.title,
        status: processing.status,
        progress: processing.progress,
        createdAt: processing.createdAt,
      },
    };
  }

  @Get('projects/:id')
  async getProject(@Headers('x-api-key') apiKey: string, @Param('id') id: string) {
    const userId = await this.authenticate(apiKey);
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      select: { id: true, title: true, status: true, progress: true, durationSeconds: true, contentType: true, createdAt: true, updatedAt: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    return { project };
  }

  @Get('projects/:id/clips')
  async listClips(@Headers('x-api-key') apiKey: string, @Param('id') projectId: string) {
    const userId = await this.authenticate(apiKey);
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Projeto não encontrado');

    const clips = await this.prisma.clip.findMany({
      where: { projectId },
      select: { id: true, title: true, start: true, end: true, duration: true, viralScore: true, finalScore: true, status: true },
      orderBy: [{ finalScore: 'desc' }, { viralScore: 'desc' }],
    });
    return { clips };
  }

  @Post('projects/:id/retry')
  async retryProject(@Headers('x-api-key') apiKey: string, @Param('id') projectId: string) {
    const userId = await this.authenticate(apiKey);
    const project = await this.projectsService.retry(userId, projectId);
    return { project };
  }

  @Delete('projects/:id')
  async deleteProject(@Headers('x-api-key') apiKey: string, @Param('id') projectId: string) {
    const userId = await this.authenticate(apiKey);
    return this.projectsService.remove(userId, projectId);
  }
}
