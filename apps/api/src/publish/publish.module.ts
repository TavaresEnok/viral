import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { PublishController } from './publish.controller.js';
import { PublishService } from './publish.service.js';
import { QueueService } from '../queue/queue.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [PublishController],
  providers: [PublishService, PrismaService, QueueService],
})
export class PublishModule {}
