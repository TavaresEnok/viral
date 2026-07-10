import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import { ExportService } from './export.service.js';

@ApiTags('export')
@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('projects/:projectId/premiere')
  async premiereXml(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string, @Res() response: Response) {
    const clips = await this.exportService.getClips(user.id, projectId);
    if (!clips.length) {
      response.status(404).json({ message: 'Nenhum clip completo encontrado para exportar' });
      return;
    }
    const xml = this.exportService.generatePremiereXml(clips);
    response.setHeader('Content-Type', 'application/xml');
    response.setHeader('Content-Disposition', `attachment; filename="project-${projectId.slice(0, 8)}-premiere.xml"`);
    response.send(xml);
  }

  @Get('projects/:projectId/davinci')
  async davinciEdl(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string, @Res() response: Response) {
    const clips = await this.exportService.getClips(user.id, projectId);
    if (!clips.length) {
      response.status(404).json({ message: 'Nenhum clip completo encontrado para exportar' });
      return;
    }
    const edl = this.exportService.generateEdl(clips);
    response.setHeader('Content-Type', 'text/plain');
    response.setHeader('Content-Disposition', `attachment; filename="project-${projectId.slice(0, 8)}-davinci.edl"`);
    response.send(edl);
  }
}
