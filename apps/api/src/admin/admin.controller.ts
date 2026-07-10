import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AdminGuard } from '../common/admin.guard.js';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import type { RequestUser } from '../common/request-user.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Get('users')
  users(@Query('page') page?: string, @Query('search') search?: string) {
    return this.adminService.users({ page: page ? Number(page) : 1, search });
  }

  @Get('top-users')
  topUsers(@Query('limit') limit?: string) {
    return this.adminService.topUsers(limit ? Number(limit) : 8);
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.adminService.userDetail(id);
  }

  @Post('users/:id/admin')
  setAdmin(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body() body: { value: boolean },
    @Req() req: Request,
  ) {
    return this.adminService.setAdmin(actor.id, id, Boolean(body?.value), req.ip);
  }

  @Post('users/:id/suspend')
  setSuspended(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body() body: { value: boolean },
    @Req() req: Request,
  ) {
    return this.adminService.setSuspended(actor.id, id, Boolean(body?.value), req.ip);
  }

  @Post('users/:id/plan')
  setPlan(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body() body: { plan: string },
    @Req() req: Request,
  ) {
    return this.adminService.setPlan(actor.id, id, body?.plan, req.ip);
  }

  @Post('users/:id/verify-email')
  verifyEmail(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminService.verifyUserEmail(actor.id, id, req.ip);
  }

  @Get('financial')
  financial() {
    return this.adminService.financial();
  }

  @Get('content')
  content(@Query('page') page?: string, @Query('status') status?: string) {
    return this.adminService.content({ page: page ? Number(page) : 1, status });
  }

  @Get('ai-config')
  aiConfig() {
    return this.adminService.getAiConfig();
  }

  @Put('ai-config')
  setAiConfig(@CurrentUser() actor: RequestUser, @Body() body: Parameters<AdminService['setAiConfig']>[1], @Req() req: Request) {
    return this.adminService.setAiConfig(actor.id, body ?? {}, req.ip);
  }

  @Get('growth')
  growth() {
    return this.adminService.growth();
  }

  @Get('audit')
  audit(@Query('page') page?: string, @Query('scope') scope?: string) {
    return this.adminService.auditTrail({ page: page ? Number(page) : 1, scope });
  }

  @Get('operations/queue')
  queue() {
    return this.adminService.queueStatus();
  }

  @Get('operations/stuck')
  stuck(@Query('minutes') minutes?: string) {
    return this.adminService.stuckProjects(minutes ? Number(minutes) : 30);
  }

  @Post('projects/:id/requeue')
  requeue(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminService.requeueProject(actor.id, id, req.ip);
  }

  @Post('projects/:id/cancel')
  cancel(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminService.cancelProject(actor.id, id, req.ip);
  }
}
