import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { PublicApiController } from './public-api.controller.js';
import { PublicApiService } from './public-api.service.js';
import { ProjectsModule } from '../projects/projects.module.js';

@Module({
  imports: [ProjectsModule],
  controllers: [PublicApiController],
  providers: [PublicApiService, PrismaService],
})
export class PublicApiModule {}
