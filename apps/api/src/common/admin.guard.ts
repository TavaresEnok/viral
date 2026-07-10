import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service.js';
import type { RequestUser } from './request-user.js';

/**
 * Guard for the founder/operator admin panel.
 * Requires the authenticated user to have isAdmin = true.
 *
 * Must run AFTER JwtAuthGuard (which populates request.user). The flag is read
 * fresh from the DB on every request so revoking admin takes effect immediately
 * without waiting for the JWT to expire.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Acesso negado');
    }

    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });

    if (!record?.isAdmin) {
      this.logger.warn({
        msg: 'Unauthorized admin access attempt',
        userId: user.id,
        email: user.email,
        ip: request.ip,
      });
      throw new ForbiddenException('Acesso negado');
    }

    return true;
  }
}
