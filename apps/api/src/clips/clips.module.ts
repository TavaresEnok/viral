import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { QueueService } from '../queue/queue.service.js';
import { ClipsController } from './clips.controller.js';
import { ClipsService } from './clips.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [ClipsController],
  providers: [ClipsService, PrismaService, QueueService],
})
export class ClipsModule {}
