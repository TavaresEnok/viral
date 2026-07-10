import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { QuotaService } from './quota.service.js';
import { QuotaController } from './quota.controller.js';

@Global()
@Module({
  imports: [JwtConfigModule],
  controllers: [QuotaController],
  providers: [QuotaService, PrismaService],
  exports: [QuotaService],
})
export class QuotaModule {}
