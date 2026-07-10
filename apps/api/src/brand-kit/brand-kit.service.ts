import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { assertPathInsideStorage } from '../common/safe-path.helper.js';
import { unlink } from 'node:fs/promises';
import type { CreateBrandKitDto, UpdateBrandKitDto } from './dto.js';

@Injectable()
export class BrandKitService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.brandKit.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async get(userId: string, id: string) {
    const kit = await this.prisma.brandKit.findFirst({ where: { id, userId } });
    if (!kit) {
      throw new NotFoundException('Brand kit não encontrado');
    }
    return kit;
  }

  async create(userId: string, dto: CreateBrandKitDto) {
    return this.prisma.brandKit.create({
      data: { userId, ...dto },
    });
  }

  async update(userId: string, id: string, dto: UpdateBrandKitDto) {
    await this.get(userId, id);
    return this.prisma.brandKit.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const kit = await this.get(userId, id);
    if (kit.logoPath) {
      unlink(assertPathInsideStorage(kit.logoPath)).catch(() => {});
    }
    await this.prisma.brandKit.delete({ where: { id } });
    return { ok: true };
  }

  async setLogo(userId: string, id: string, filePath: string) {
    const existing = await this.get(userId, id);
    if (existing.logoPath) {
      unlink(assertPathInsideStorage(existing.logoPath)).catch(() => {});
    }
    return this.prisma.brandKit.update({ where: { id }, data: { logoPath: filePath } });
  }

  async getLogoPath(userId: string, id: string) {
    const kit = await this.get(userId, id);
    if (!kit.logoPath) throw new NotFoundException('Logo não encontrado');
    assertPathInsideStorage(kit.logoPath);
    return kit.logoPath;
  }

  getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    return mimeMap[ext] ?? 'application/octet-stream';
  }
}
