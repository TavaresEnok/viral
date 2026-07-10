import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Headers, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PublicApiService } from './public-api.service.js';
import { PrismaService } from '../prisma.service.js';

@ApiTags('public-api')
@Controller('api/v1')
export class PublicApiController {
  constructor(
    private readonly publicApiService: PublicApiService,
    private readonly prisma: PrismaService,
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
}
