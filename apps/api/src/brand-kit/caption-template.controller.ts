import { Body, Controller, Delete, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import type { CreateCaptionTemplateDto } from './dto.js';

@Controller('caption-templates')
@UseGuards(JwtAuthGuard)
export class CaptionTemplateController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.captionTemplate.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCaptionTemplateDto) {
    return this.prisma.captionTemplate.create({ data: { userId: user.id, ...dto } });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const tmpl = await this.prisma.captionTemplate.findFirst({ where: { id, userId: user.id } });
    if (!tmpl) {
      throw new NotFoundException('Template não encontrado');
    }
    await this.prisma.captionTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
