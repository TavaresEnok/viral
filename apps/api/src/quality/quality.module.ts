import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { QualityController } from './quality.controller.js';
import { QualityService } from './quality.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [QualityController],
  providers: [QualityService, PrismaService],
})
export class QualityModule {}
