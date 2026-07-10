import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { BrandKitController } from './brand-kit.controller.js';
import { BrandKitService } from './brand-kit.service.js';
import { CaptionTemplateController } from './caption-template.controller.js';

@Module({
  imports: [JwtConfigModule],
  controllers: [BrandKitController, CaptionTemplateController],
  providers: [BrandKitService, PrismaService],
  exports: [BrandKitService],
})
export class BrandKitModule {}
