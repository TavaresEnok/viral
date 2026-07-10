import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from './request-user.js';

/**
 * Guard for internal-only administrative endpoints.
 * Requires the X-Master-Secret header to match MASTER_SECRET env var.
 *
 * The caller must still be authenticated (use JwtAuthGuard first).
 * This guard adds a second layer ensuring only operators with the master secret
 * can trigger sensitive operations like storage cleanup.
 */
@Injectable()
export class MasterSecretGuard implements CanActivate {
  private readonly logger = new Logger(MasterSecretGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const secret = request.headers['x-master-secret'];
    const masterSecret = process.env.MASTER_SECRET;

    if (!masterSecret) {
      this.logger.error('MASTER_SECRET not configured — blocking all admin operations');
      throw new ForbiddenException('Operação administrativa não disponível');
    }

    if (!secret || secret !== masterSecret) {
      const user = request.user;
      this.logger.warn({
        msg: 'Unauthorized admin operation attempt',
        userId: user?.id,
        email: user?.email,
        ip: request.ip,
      });
      throw new ForbiddenException('Acesso negado');
    }

    return true;
  }
}
