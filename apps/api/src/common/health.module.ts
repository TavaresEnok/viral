import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [PrismaService],
})
export class HealthModule {}
