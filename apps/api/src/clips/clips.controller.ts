import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { assertPathInsideStorage } from '../common/safe-path.helper.js';
import type { RequestUser } from '../common/request-user.js';
import { CreateClipFeedbackDto, RenderClipDto, UpdateClipTimingDto, UpdateSubtitleSegmentsDto } from './dto.js';
import { ClipsService } from './clips.service.js';

@ApiTags('clips')
@Controller()
export class ClipsController {
  private readonly logger = new Logger(ClipsController.name);

  constructor(private readonly clipsService: ClipsService) {}

  @Get('projects/:projectId/clips')
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    return this.clipsService.list(user.id, projectId);
  }

  /**
   * Media streaming endpoint.
   * Native <video> elements are handled in the frontend via Blob URL.
   */
  @Get('clips/:clipId/download')
  @UseGuards(JwtAuthGuard)
  async download(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Res() response: Response,
  ) {
    const clip = await this.clipsService.getOwnedClip(user.id, clipId);
    if (!clip.videoPath) {
      response.status(404).json({ message: 'Arquivo do clip não encontrado' });
      return;
    }
    const safePath = assertPathInsideStorage(clip.videoPath);
    if (!existsSync(safePath)) {
      response.status(404).json({ message: 'Arquivo do clip não encontrado' });
      return;
    }
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', 'video/mp4');
    response.setHeader('Content-Disposition', `inline; filename="${clip.title.replace(/[^\w.-]+/g, '-').toLowerCase()}.mp4"`);
    response.sendFile(safePath, { root: '/' }, (err) => {
      if (err && !response.headersSent) {
        this.logger.error(`Erro ao enviar clip ${clipId}: ${err.message}`);
        response.status(500).json({ message: 'Erro ao transmitir vídeo' });
      }
    });
  }

  @Post('clips/:clipId/feedback')
  @UseGuards(JwtAuthGuard)
  feedback(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Body() dto: CreateClipFeedbackDto,
  ) {
    return this.clipsService.feedback(user.id, clipId, dto);
  }

  @Patch('clips/:clipId/timing')
  @UseGuards(JwtAuthGuard)
  updateTiming(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Body() dto: UpdateClipTimingDto,
  ) {
    return this.clipsService.updateTiming(user.id, clipId, dto);
  }

  @Post('clips/:clipId/render')
  @UseGuards(JwtAuthGuard)
  render(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Body() dto: RenderClipDto,
  ) {
    return this.clipsService.render(user.id, clipId, dto);
  }

  @Get('clips/:clipId/segments')
  @UseGuards(JwtAuthGuard)
  getSegments(@CurrentUser() user: RequestUser, @Param('clipId') clipId: string) {
    return this.clipsService.getSegments(user.id, clipId);
  }

  /** Regera a legenda deste corte com IA (whisper local). Não renderiza. */
  @Post('clips/:clipId/retranscribe')
  @UseGuards(JwtAuthGuard)
  retranscribe(@CurrentUser() user: RequestUser, @Param('clipId') clipId: string) {
    return this.clipsService.retranscribe(user.id, clipId);
  }

  @Patch('clips/:clipId/segments')
  @UseGuards(JwtAuthGuard)
  updateSegments(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Body() dto: UpdateSubtitleSegmentsDto,
  ) {
    return this.clipsService.updateSegments(user.id, clipId, dto);
  }

  @Delete('clips/:clipId/segments')
  @UseGuards(JwtAuthGuard)
  resetSegments(@CurrentUser() user: RequestUser, @Param('clipId') clipId: string) {
    return this.clipsService.resetSegments(user.id, clipId);
  }

  @Delete('clips/:clipId')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: RequestUser, @Param('clipId') clipId: string) {
    return this.clipsService.remove(user.id, clipId);
  }

  /** Media endpoint */
  @Get('clips/:clipId/thumbnail')
  @UseGuards(JwtAuthGuard)
  async thumbnail(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Res() response: Response,
  ) {
    const clip = await this.clipsService.getOwnedClip(user.id, clipId);
    if (!clip.thumbnailPath) {
      response.status(404).json({ message: 'Thumbnail não encontrada' });
      return;
    }
    const safePath = assertPathInsideStorage(clip.thumbnailPath);
    if (!existsSync(safePath)) {
      response.status(404).json({ message: 'Thumbnail não encontrada' });
      return;
    }
    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.sendFile(safePath, { root: '/' }, (err) => {
      if (err && !response.headersSent) {
        this.logger.error(`Erro ao enviar thumbnail ${clipId}: ${err.message}`);
        response.status(500).json({ message: 'Erro ao enviar thumbnail' });
      }
    });
  }

  /** Media endpoint */
  @Get('clips/:clipId/subtitle')
  @UseGuards(JwtAuthGuard)
  async subtitle(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Res() response: Response,
  ) {
    const clip = await this.clipsService.getOwnedClip(user.id, clipId);
    if (!clip.vttPath) {
      response.status(404).json({ message: 'Legenda não encontrada' });
      return;
    }
    const safePath = assertPathInsideStorage(clip.vttPath);
    if (!existsSync(safePath)) {
      response.status(404).json({ message: 'Legenda não encontrada' });
      return;
    }
    response.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    response.sendFile(safePath, { root: '/' }, (err) => {
      if (err && !response.headersSent) {
        this.logger.error(`Erro ao enviar subtitle ${clipId}: ${err.message}`);
        response.status(500).json({ message: 'Erro ao enviar legenda' });
      }
    });
  }
}
