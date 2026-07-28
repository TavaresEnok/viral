import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ALLOWED_VIDEO_MIME_TYPES, MAX_UPLOAD_BYTES } from '@viralforge/shared';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { extname, resolve } from 'node:path';
import { mkdir, rename as fsRename, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { MasterSecretGuard } from '../common/master-secret.guard.js';
import { assertPathInsideStorage } from '../common/safe-path.helper.js';
import { isValidVideoMagicBytes, isValidVideoWithFfprobe } from '../common/video-upload.helper.js';
import type { RequestUser } from '../common/request-user.js';
import { CreateProjectDto, SubmitYoutubeUrlDto, UpdateProjectDto } from './dto.js';
import { ProjectsService } from './projects.service.js';

function repoRoot() {
  return process.cwd().endsWith('/apps/api') ? resolve(process.cwd(), '../..') : process.cwd();
}

function tempUploadDir() {
  return resolve(repoRoot(), process.env.STORAGE_ROOT ?? 'storage/uploads', '.temp');
}

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projectsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projectsService.get(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projectsService.remove(user.id, id);
  }

  @Post(':id/upload')
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
  async upload(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo inválido. Use MP4, MOV, MKV ou WebM até 500MB.');
    }

    let finalPath: string | null = null;
    try {
      await this.projectsService.ensureOwner(user.id, id);

      if (!(await isValidVideoMagicBytes(file.path))) {
        throw new BadRequestException('Arquivo inválido: tipo real não corresponde à extensão informada.');
      }

      if (!(await isValidVideoWithFfprobe(file.path))) {
        throw new BadRequestException('Arquivo de vídeo corrompido ou formato não suportado/ilegível pelo processador.');
      }

      const extension = extname(file.originalname).toLowerCase();
      finalPath = assertPathInsideStorage(resolve(repoRoot(), process.env.STORAGE_ROOT ?? 'storage/uploads', user.id, id, `original${extension}`));
      const finalDir = resolve(finalPath, '..');
      await mkdir(finalDir, { recursive: true });
      await fsRename(file.path, finalPath);
      return await this.projectsService.attachUpload(user.id, id, finalPath);
    } catch (error) {
      await rm(file.path, { force: true }).catch(() => undefined);
      if (finalPath) await rm(finalPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  @Post(':id/youtube')
  submitYoutubeUrl(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SubmitYoutubeUrlDto,
  ) {
    return this.projectsService.attachYoutubeUrl(user.id, id, dto.youtubeUrl);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projectsService.retry(user.id, id);
  }

  @Post('cleanup-temp')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, MasterSecretGuard)
  async cleanupTemp(): Promise<{ deleted: number }> {
    const { cleanTempStorage } = await import('../common/storage-cleanup.helper.js');
    const deleted = await cleanTempStorage(tempUploadDir());
    return { deleted };
  }
}
