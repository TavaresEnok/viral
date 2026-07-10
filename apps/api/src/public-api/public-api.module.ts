import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { PublicApiController } from './public-api.controller.js';
import { PublicApiService } from './public-api.service.js';

@Module({
  controllers: [PublicApiController],
  providers: [PublicApiService, PrismaService],
})
export class PublicApiModule {}
