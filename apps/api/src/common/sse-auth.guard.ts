import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { RequestUser } from './request-user.js';

/**
 * SSE-specific JWT guard that accepts the token from either:
 * 1. `Authorization: Bearer <token>` header (standard)
 * 2. `?token=<token>` query parameter (needed for EventSource which cannot send headers)
 *
 * The query param is scoped to SSE endpoints only — never use this guard on
 * endpoints that return sensitive data in the response body (media files, etc.).
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();

    // Prefer header token; fall back to query param for EventSource compatibility
    const header = request.headers.authorization;
    const token =
      (header?.startsWith('Bearer ') ? header.slice(7) : null) ??
      (typeof request.query['token'] === 'string' ? request.query['token'] : null);

    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email?: string;
        projectId?: string;
        type?: string;
      }>(token);

      if (payload.type === 'sse-ticket') {
        const routeProjectId = request.params['projectId'];
        if (payload.projectId !== routeProjectId) {
          throw new UnauthorizedException('Ticket inválido para este projeto');
        }
      }

      request.user = { id: payload.sub, email: payload.email ?? '' };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
