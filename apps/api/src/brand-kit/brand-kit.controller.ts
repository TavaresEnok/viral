import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException, Res, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'node:path';
import { createReadStream, mkdirSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { storageRoot, assertPathInsideStorage } from '../common/safe-path.helper.js';
import type { RequestUser } from '../common/request-user.js';
import { BrandKitService } from './brand-kit.service.js';
import type { CreateBrandKitDto, UpdateBrandKitDto } from './dto.js';
import type { Response } from 'express';

const IMAGE_MAGIC_BYTES: Record<string, Uint8Array> = {
  'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  'image/webp': new Uint8Array([0x52, 0x49, 0x46, 0x46]),
};
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function validateImageMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const expected = IMAGE_MAGIC_BYTES[mimetype];
  if (!expected) return false;
  return buffer.slice(0, expected.length).equals(expected);
}

@ApiTags('brand-kit')
@Controller('brand-kits')
@UseGuards(JwtAuthGuard)
export class BrandKitController {
  constructor(private readonly brandKitService: BrandKitService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.brandKitService.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.brandKitService.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBrandKitDto) {
    return this.brandKitService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateBrandKitDto) {
    return this.brandKitService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.brandKitService.remove(user.id, id);
  }

  @Get(':id/logo')
  @Header('Cache-Control', 'private, max-age=86400')
  async getLogo(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() res: Response) {
    const filePath = await this.brandKitService.getLogoPath(user.id, id);
    const mime = this.brandKitService.getMimeType(filePath);
    res.setHeader('Content-Type', mime);
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = resolve(storageRoot(), 'brand-kits');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = IMAGE_EXTENSIONS[file.mimetype] ?? extname(file.originalname).toLowerCase();
          cb(null, `logo-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file || !file.path) {
      throw new BadRequestException('Arquivo não enviado');
    }

    try {
      await this.brandKitService.get(user.id, id);
      assertPathInsideStorage(file.path);
      const buffer = await readFile(file.path);

      if (!validateImageMagicBytes(buffer, file.mimetype)) {
        throw new BadRequestException('Arquivo não é uma imagem válida (JPEG, PNG ou WebP)');
      }

      return await this.brandKitService.setLogo(user.id, id, file.path);
    } catch (error) {
      await rm(file.path, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
