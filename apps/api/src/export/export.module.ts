import { Module } from '@nestjs/common';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { PrismaService } from '../prisma.service.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [ExportController],
  providers: [ExportService, PrismaService],
})
export class ExportModule {}
