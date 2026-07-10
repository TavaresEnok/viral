import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import { UpdateApiKeysDto, UpsertAiProviderDto } from './dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('users/me/api-keys')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  status(@CurrentUser() user: RequestUser) {
    return this.settingsService.status(user.id);
  }

  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateApiKeysDto) {
    return this.settingsService.updateApiKeys(user.id, dto);
  }

  @Delete()
  remove(@CurrentUser() user: RequestUser) {
    return this.settingsService.removeApiKeys(user.id);
  }

  @Delete(':provider')
  removeProvider(@CurrentUser() user: RequestUser, @Param('provider') provider: string) {
    return this.settingsService.removeApiKey(user.id, provider);
  }

  @Get('providers')
  providers(@CurrentUser() user: RequestUser) {
    return this.settingsService.providers(user.id);
  }

  @Put('providers')
  upsertProvider(@CurrentUser() user: RequestUser, @Body() dto: UpsertAiProviderDto) {
    return this.settingsService.upsertProvider(user.id, dto);
  }

  @Put('providers/:provider/active')
  activateProvider(@CurrentUser() user: RequestUser, @Param('provider') provider: string, @Query('role') role?: string) {
    return this.settingsService.activateProviderForRole(user.id, provider, role ?? 'PASS1');
  }

  @Post('providers/:provider/test')
  testProvider(@CurrentUser() user: RequestUser, @Param('provider') provider: string, @Query('role') role?: string) {
    return this.settingsService.testProvider(user.id, provider, role);
  }

  @Delete('providers/:provider')
  removeAiProvider(@CurrentUser() user: RequestUser, @Param('provider') provider: string, @Query('role') role?: string) {
    return this.settingsService.removeAiProvider(user.id, provider, role);
  }
}
