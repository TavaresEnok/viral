import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Ip, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import { PrismaService } from '../prisma.service.js';
import { PublicApiService } from '../public-api/public-api.service.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto, VerifyEmailDto } from './dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly publicApiService: PublicApiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const auth = await this.authService.register(dto);
    this.setRefreshCookie(response, auth.refreshToken, auth.refreshExpiresAt);
    return this.publicAuthResponse(auth);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Res({ passthrough: true }) response: Response) {
    const auth = await this.authService.login(dto, ip);
    this.setRefreshCookie(response, auth.refreshToken, auth.refreshExpiresAt);
    return this.publicAuthResponse(auth);
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const auth = await this.authService.refresh(this.readRefreshCookie(request));
    this.setRefreshCookie(response, auth.refreshToken, auth.refreshExpiresAt);
    return this.publicAuthResponse(auth);
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
    return result;
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.logoutAll(user.id);
    this.clearRefreshCookie(response);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  // ─── E-mail Verification ──────────────────────────────────────────────────

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  resendVerification(@CurrentUser() user: RequestUser) {
    return this.authService.resendVerification(user.id);
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async generateApiKey(@CurrentUser() user: RequestUser) {
    const { apiKey, keyHash } = this.publicApiService.generateApiKey();
    await this.prisma.apiKey.create({
      data: { userId: user.id, keyHash, label: `API Key ${Date.now()}` },
    });
    return { apiKey };
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async listApiKeys(@CurrentUser() user: RequestUser) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { id: true, label: true, active: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { keys };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private publicAuthResponse(auth: Awaited<ReturnType<AuthService['login']>>) {
    return {
      user: auth.user,
      token: auth.token,
    };
  }

  private readRefreshCookie(request: Request) {
    const rawCookie = request.headers.cookie ?? '';
    const match = rawCookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${this.cookieName()}=`));
    return match ? decodeURIComponent(match.slice(this.cookieName().length + 1)) : undefined;
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(this.cookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/auth',
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(this.cookieName(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
    });
  }

  private cookieName() {
    return process.env.REFRESH_COOKIE_NAME ?? 'viralforge_refresh';
  }
}
