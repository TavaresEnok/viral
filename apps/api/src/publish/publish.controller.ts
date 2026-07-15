import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, Res, HttpCode } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsEnum } from 'class-validator';
import { PublishStatus, SocialPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { RequestUser } from '../common/request-user.js';
import { PublishService } from './publish.service.js';
import { verifyOAuthState, getWebOrigin } from '@viralforge/shared';
import type { Response } from 'express';

class PublishClipDto {
  @IsString()
  @IsNotEmpty()
  socialAccountId!: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}

class CalendarQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;
}

class RescheduleDto {
  @IsISO8601()
  scheduledAt!: string;
}

class RefreshYouTubeDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;
}

class ConnectTikTokDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  openId!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;
}

class ConnectInstagramDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;
}

@ApiTags('publish')
@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  listAccounts(@CurrentUser() user: RequestUser) {
    return this.publishService.listAccounts(user.id);
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard)
  disconnectAccount(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.publishService.disconnectAccount(user.id, id);
  }

  @Get('clips')
  @UseGuards(JwtAuthGuard)
  listPublished(@CurrentUser() user: RequestUser) {
    return this.publishService.listPublishedClips(user.id);
  }

  @Get('calendar')
  @UseGuards(JwtAuthGuard)
  listCalendar(@CurrentUser() user: RequestUser, @Query() query: CalendarQueryDto) {
    return this.publishService.listCalendar(user.id, query.from, query.to, query.status, query.platform);
  }

  @Patch('schedule/:id')
  @UseGuards(JwtAuthGuard)
  reschedule(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.publishService.reschedule(user.id, id, dto.scheduledAt);
  }

  @Delete('schedule/:id')
  @UseGuards(JwtAuthGuard)
  cancelScheduled(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.publishService.cancelScheduled(user.id, id);
  }

  @Post('clip/:clipId')
  @UseGuards(JwtAuthGuard)
  publishClip(
    @CurrentUser() user: RequestUser,
    @Param('clipId') clipId: string,
    @Body() dto: PublishClipDto,
  ) {
    return this.publishService.publishClip(user.id, clipId, dto.socialAccountId, dto.scheduledAt);
  }

  // Os endpoints /auth retornam a URL de autorização (via fetch autenticado);
  // o front navega até ela. Não dá pra redirecionar direto porque navegação de
  // página não carrega o header Authorization (JwtAuthGuard exige o header).
  @Get('youtube/auth')
  @UseGuards(JwtAuthGuard)
  youtubeAuth(@CurrentUser() user: RequestUser) {
    return { url: this.publishService.buildYouTubeAuthUrl(user.id) };
  }

  @Get('youtube/callback')
  async youtubeCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const web = getWebOrigin();
    const userId = state ? verifyOAuthState(state) : null;
    if (!userId) return res.redirect(`${web}/dashboard/connections?error=state`);
    try {
      await this.publishService.handleYouTubeCallback(userId, code);
      return res.redirect(`${web}/dashboard/connections?connected=youtube`);
    } catch {
      return res.redirect(`${web}/dashboard/connections?error=youtube`);
    }
  }

  @Get('tiktok/auth')
  @UseGuards(JwtAuthGuard)
  tiktokAuth(@CurrentUser() user: RequestUser) {
    return { url: this.publishService.buildTikTokAuthUrl(user.id) };
  }

  @Get('tiktok/callback')
  async tiktokCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const web = getWebOrigin();
    const userId = state ? verifyOAuthState(state) : null;
    if (!userId) return res.redirect(`${web}/dashboard/connections?error=state`);
    try {
      await this.publishService.handleTikTokCallback(userId, code);
      return res.redirect(`${web}/dashboard/connections?connected=tiktok`);
    } catch {
      return res.redirect(`${web}/dashboard/connections?error=tiktok`);
    }
  }

  @Get('instagram/auth')
  @UseGuards(JwtAuthGuard)
  instagramAuth(@CurrentUser() user: RequestUser) {
    return { url: this.publishService.buildInstagramAuthUrl(user.id) };
  }

  @Get('instagram/callback')
  async instagramCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const web = getWebOrigin();
    const userId = state ? verifyOAuthState(state) : null;
    if (!userId) return res.redirect(`${web}/dashboard/connections?error=state`);
    try {
      await this.publishService.handleInstagramCallback(userId, code);
      return res.redirect(`${web}/dashboard/connections?connected=instagram`);
    } catch {
      return res.redirect(`${web}/dashboard/connections?error=instagram`);
    }
  }

  @Post('youtube/refresh')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async youtubeRefresh(@CurrentUser() user: RequestUser, @Body() dto: RefreshYouTubeDto) {
    return this.publishService.refreshYouTubeToken(user.id, dto.accountId);
  }

  @Post('tiktok/connect')
  @UseGuards(JwtAuthGuard)
  async connectTikTok(@CurrentUser() user: RequestUser, @Body() dto: ConnectTikTokDto) {
    return this.publishService.connectTikTok(user.id, dto.accessToken, dto.openId, dto.username);
  }

  @Post('instagram/connect')
  @UseGuards(JwtAuthGuard)
  async connectInstagram(@CurrentUser() user: RequestUser, @Body() dto: ConnectInstagramDto) {
    return this.publishService.connectInstagram(user.id, dto.accessToken, dto.businessId, dto.username);
  }
}
