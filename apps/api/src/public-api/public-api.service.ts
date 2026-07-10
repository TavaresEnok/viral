import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class PublicApiService {
  constructor(private readonly prisma: PrismaService) {}

  async validateApiKey(apiKey: string): Promise<string> {
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hash } });
    if (!key || !key.active) throw new UnauthorizedException('API key inválida ou inativa');
    if (key.expiresAt && key.expiresAt < new Date()) throw new UnauthorizedException('API key expirada');

    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return key.userId;
  }

  generateApiKey(): { apiKey: string; keyHash: string } {
    const apiKey = `viralforge_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    return { apiKey, keyHash };
  }
}
