import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { QueueService } from '../queue/queue.service.js';
import { QuotaService } from '../quota/quota.service.js';
import { QuickCaptionController } from './quick-caption.controller.js';
import { QuickCaptionService } from './quick-caption.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [QuickCaptionController],
  providers: [QuickCaptionService, PrismaService, QueueService, QuotaService],
})
export class QuickCaptionModule {}
