import { ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ALLOWED_VIDEO_MIME_TYPES, MAX_UPLOAD_BYTES } from '@viralforge/shared';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { mkdir, rename as fsRename, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { assertPathInsideStorage } from '../common/safe-path.helper.js';
import { isValidVideoMagicBytes, isValidVideoWithFfprobe, probeVideoDurationSeconds } from '../common/video-upload.helper.js';
import type { RequestUser } from '../common/request-user.js';
import { CreateBatchDto, UpdateBatchDto, UpdateItemDto } from './dto.js';
import { QuickCaptionService } from './quick-caption.service.js';

function repoRoot() {
  return process.cwd().endsWith('/apps/api') ? resolve(process.cwd(), '../..') : process.cwd();
}

function tempUploadDir() {
  return resolve(repoRoot(), process.env.STORAGE_ROOT ?? 'storage/uploads', '.temp');
}

@ApiTags('quick-caption')
@Controller('quick-caption')
@UseGuards(JwtAuthGuard)
export class QuickCaptionController {
  private readonly logger = new Logger(QuickCaptionController.name);

  constructor(private readonly service: QuickCaptionService) {}

  @Get('batches')
  listBatches(@CurrentUser() user: RequestUser) {
    return this.service.listBatches(user.id);
  }

  @Post('batches')
  createBatch(@CurrentUser() user: RequestUser, @Body() dto: CreateBatchDto) {
    return this.service.createBatch(user.id, dto);
  }

  @Get('batches/:id')
  getBatch(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.getBatch(user.id, id);
  }

  @Patch('batches/:id')
  updateBatch(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.service.updateBatch(user.id, id, dto);
  }

  @Delete('batches/:id')
  deleteBatch(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.deleteBatch(user.id, id);
  }

  @Post('batches/:id/render')
  renderBatch(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.renderBatch(user.id, id);
  }

  @Post('batches/:id/items')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        const validMime = ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype as never);
        const validExtension = ['.mp4', '.mov', '.mkv', '.webm'].includes(extension);
        callback(null, validMime || validExtension);
      },
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dir = tempUploadDir();
          mkdirSync(dir, { recursive: true });
          callback(null, dir);
        },
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
    }),
  )
  async uploadItem(
    @CurrentUser() user: RequestUser,
    @Param('id') batchId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo inválido. Use MP4, MOV, MKV ou WebM até 500MB.');
    }

    let finalPath: string | null = null;
    try {
      await this.service.ensureOwnedBatch(user.id, batchId);

      if (!(await isValidVideoMagicBytes(file.path))) {
        throw new BadRequestException('Arquivo inválido: tipo real não corresponde à extensão informada.');
      }
      if (!(await isValidVideoWithFfprobe(file.path))) {
        throw new BadRequestException('Arquivo de vídeo corrompido ou formato não suportado/ilegível pelo processador.');
      }

      const durationSeconds = await probeVideoDurationSeconds(file.path).catch(() => {
        throw new BadRequestException('Não foi possível determinar a duração do vídeo.');
      });

      const itemId = randomUUID();
      const extension = extname(file.originalname).toLowerCase();
      finalPath = assertPathInsideStorage(
        resolve(repoRoot(), process.env.STORAGE_ROOT ?? 'storage/uploads', user.id, 'quick-caption', batchId, itemId, `original${extension}`),
      );
      const finalDir = resolve(finalPath, '..');
      await mkdir(finalDir, { recursive: true });
      await fsRename(file.path, finalPath);

      return await this.service.createItem(user.id, batchId, finalPath, durationSeconds);
    } catch (error) {
      await rm(file.path, { force: true }).catch(() => undefined);
      if (finalPath) await rm(finalPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  @Patch('items/:id')
  updateItem(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.service.updateItem(user.id, id, dto);
  }

  @Delete('items/:id')
  deleteItem(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.deleteItem(user.id, id);
  }

  @Get('items/:id/download')
  async downloadItem(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() response: Response) {
    const item = await this.service.getOwnedItem(user.id, id);
    if (!item.videoPath) {
      response.status(404).json({ message: 'Vídeo renderizado ainda não disponível' });
      return;
    }
    const safePath = assertPathInsideStorage(item.videoPath);
    if (!existsSync(safePath)) {
      response.status(404).json({ message: 'Arquivo não encontrado' });
      return;
    }
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', 'video/mp4');
    response.setHeader('Content-Disposition', `inline; filename="quick-caption-${id}.mp4"`);
    response.sendFile(safePath, { root: '/' }, (err) => {
      if (err && !response.headersSent) {
        this.logger.error(`Erro ao enviar item ${id}: ${err.message}`);
        response.status(500).json({ message: 'Erro ao transmitir vídeo' });
      }
    });
  }
}
