import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { QueueService } from '../queue/queue.service.js';
import { QuotaService } from '../quota/quota.service.js';
import { ChannelImportController } from './channel-import.controller.js';
import { ChannelImportService } from './channel-import.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [ChannelImportController],
  providers: [ChannelImportService, PrismaService, QueueService, QuotaService],
})
export class ChannelImportModule {}
