import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import { QualityService } from './quality.service.js';

@ApiTags('quality')
@Controller('quality')
@UseGuards(JwtAuthGuard)
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('overview')
  overview(@CurrentUser() user: RequestUser) {
    return this.qualityService.overview(user.id);
  }
}
