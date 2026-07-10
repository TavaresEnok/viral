import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Request, Response } from 'express';
import { REDIS_CONFIG } from '@viralforge/shared';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  count: number;
  resetAt: number;
  source: 'redis' | 'memory';
}

interface RateLimitStore {
  increment(key: string, ttlMs: number): Promise<RateLimitResult>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();

  async increment(key: string, ttlMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + ttlMs };
      this.store.set(key, entry);
    }
    entry.count += 1;
    return { ...entry, source: 'memory' };
  }
}

export class RedisRateLimitStore implements RateLimitStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitStore.name);
  private readonly fallback = new MemoryRateLimitStore();
  private readonly redis?: InstanceType<typeof Redis>;
  private warned = false;

  constructor(private readonly prefix = 'viralforge:rate') {
    if (process.env.REDIS_RATE_LIMIT_ENABLED === 'false') {
      return;
    }

    this.redis = new Redis({
      ...REDIS_CONFIG,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  async increment(key: string, ttlMs: number): Promise<RateLimitResult> {
    if (!this.redis) {
      return this.fallback.increment(key, ttlMs);
    }

    const redisKey = `${this.prefix}:${key}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.pexpire(redisKey, ttlMs);
      }
      const pttl = await this.redis.pttl(redisKey);
      const resetAt = Date.now() + (pttl > 0 ? pttl : ttlMs);
      return { count, resetAt, source: 'redis' };
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn({
          msg: 'Redis indisponível para rate limit; usando fallback em memória',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return this.fallback.increment(key, ttlMs);
    }
  }
}

@Injectable()
export class ThrottlerGuard implements CanActivate {
  constructor(
    private readonly limit: number = 60,
    private readonly ttlMs: number = 60_000,
    private readonly store: RateLimitStore = new RedisRateLimitStore(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const policy = this.resolvePolicy(request);
    const key = `${policy.bucket}:${this.requestKey(request)}`;
    const result = await this.store.increment(key, policy.ttlMs);
    const remaining = Math.max(0, policy.limit - result.count);
    const resetSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

    response?.setHeader?.('X-RateLimit-Limit', String(policy.limit));
    response?.setHeader?.('X-RateLimit-Remaining', String(remaining));
    response?.setHeader?.('X-RateLimit-Reset', String(resetSeconds));
    response?.setHeader?.('X-RateLimit-Store', result.source);

    if (result.count > policy.limit) {
      throw new HttpException('Muitas requisições. Tente novamente em instantes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private requestKey(request: Request) {
    return (request.ip || request.socket?.remoteAddress || 'unknown').trim();
  }

  private resolvePolicy(request: Request) {
    const path = request.path ?? request.url ?? '';
    const sensitiveAuthPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/resend-verification',
    ];
    if (sensitiveAuthPaths.some((prefix) => path.startsWith(prefix))) {
      return {
        bucket: 'auth',
        limit: Number(process.env.AUTH_RATE_LIMIT ?? 10),
        ttlMs: Number(process.env.AUTH_RATE_LIMIT_TTL_MS ?? 60_000),
      };
    }
    if (
      request.method === 'POST' &&
      (path === '/projects' || /\/projects\/[^/]+\/(upload|youtube|retry)$/.test(path))
    ) {
      return {
        bucket: 'project-write',
        limit: Number(process.env.PROJECT_WRITE_RATE_LIMIT ?? 20),
        ttlMs: Number(process.env.PROJECT_WRITE_RATE_LIMIT_TTL_MS ?? 60_000),
      };
    }
    return {
      bucket: 'global',
      limit: this.limit,
      ttlMs: this.ttlMs,
    };
  }
}

export function createGlobalThrottler() {
  return new ThrottlerGuard(
    Number(process.env.GLOBAL_RATE_LIMIT ?? 60),
    Number(process.env.GLOBAL_RATE_LIMIT_TTL_MS ?? 60_000),
  );
}
