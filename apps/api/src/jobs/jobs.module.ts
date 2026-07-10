import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { SseAuthGuard } from '../common/sse-auth.guard.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [JobsController],
  // SseAuthGuard must be a provider so NestJS can inject JwtService into it
  providers: [JobsService, PrismaService, SseAuthGuard],
})
export class JobsModule {}
