import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import { CreateChannelImportDto, ImportSelectedVideosDto } from './dto.js';
import { ChannelImportService } from './channel-import.service.js';

@ApiTags('channel-import')
@Controller('channel-import')
@UseGuards(JwtAuthGuard)
export class ChannelImportController {
  constructor(private readonly service: ChannelImportService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.service.listRequests(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateChannelImportDto) {
    return this.service.createRequest(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.getRequest(user.id, id);
  }

  @Post(':id/import')
  importSelected(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ImportSelectedVideosDto,
  ) {
    return this.service.importSelected(user.id, id, dto);
  }
}
