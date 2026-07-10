import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

describe('ThrottlerGuard (unit)', () => {
  it('allows requests within limit', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(5, 60_000, new MemoryRateLimitStore());
    const mockCtx = ctx('127.0.0.1');
    for (let i = 0; i < 5; i++) {
      await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
    }
  });

  it('blocks request over limit', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(3, 60_000, new MemoryRateLimitStore());
    const mockCtx = ctx('10.0.0.1');
    for (let i = 0; i < 3; i++) {
      await guard.canActivate(mockCtx);
    }
    await expect(guard.canActivate(mockCtx)).rejects.toThrow('Muitas requisições');
  });

  it('resets after TTL', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(2, 1, new MemoryRateLimitStore());
    const mockCtx = ctx('10.0.0.2');
    await guard.canActivate(mockCtx);
    await guard.canActivate(mockCtx);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(guard.canActivate(mockCtx)).resolves.toBe(true);
  });

  it('treats different IPs separately', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(2, 60_000, new MemoryRateLimitStore());
    const ctx1 = ctx('10.0.0.3');
    const ctx2 = ctx('10.0.0.4');
    await guard.canActivate(ctx1);
    await guard.canActivate(ctx1);
    await expect(guard.canActivate(ctx1)).rejects.toThrow('Muitas requisições');
    await expect(guard.canActivate(ctx2)).resolves.toBe(true);
  });

  it('applies stricter auth bucket to sensitive auth endpoints', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(60, 60_000, new MemoryRateLimitStore());
    for (const path of [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/resend-verification',
    ]) {
      const headers = new Map<string, string>();
      await guard.canActivate(ctx('10.0.1.1', headers, path));
      expect(headers.get('X-RateLimit-Limit'), path).toBe('10');
    }
  });

  it('keeps the global bucket for non-sensitive routes', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(60, 60_000, new MemoryRateLimitStore());
    const headers = new Map<string, string>();
    await guard.canActivate(ctx('10.0.1.2', headers, '/auth/me'));
    expect(headers.get('X-RateLimit-Limit')).toBe('60');
  });

  it('sets rate limit headers', async () => {
    const { MemoryRateLimitStore, ThrottlerGuard } = await import('./throttler.guard.js');
    const guard = new ThrottlerGuard(2, 60_000, new MemoryRateLimitStore());
    const headers = new Map<string, string>();
    await guard.canActivate(ctx('10.0.0.5', headers));
    expect(headers.get('X-RateLimit-Limit')).toBe('2');
    expect(headers.get('X-RateLimit-Remaining')).toBe('1');
    expect(headers.get('X-RateLimit-Store')).toBe('memory');
  });
});

function ctx(ip: string, headers = new Map<string, string>(), path = '/'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, path, headers: {}, socket: { remoteAddress: ip } }),
      getResponse: () => ({ setHeader: (key: string, value: string) => headers.set(key, value) }),
    }),
  } as unknown as ExecutionContext;
}
