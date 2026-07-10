import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SseAuthGuard } from './sse-auth.guard.js';
import type { RequestUser } from './request-user.js';

const fakeVerify = vi.fn();
const jwtService = { verifyAsync: fakeVerify } as unknown as JwtService;

function makeCtx(overrides: {
  authorization?: string;
  query?: Record<string, string>;
} = {}): ExecutionContext {
  const req = {
    headers: { authorization: overrides.authorization },
    query: overrides.query ?? {},
    user: undefined as RequestUser | undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SseAuthGuard', () => {
  let guard: SseAuthGuard;
  beforeEach(() => {
    guard = new SseAuthGuard(jwtService);
    vi.clearAllMocks();
  });

  it('accepts a valid Bearer header token', async () => {
    fakeVerify.mockResolvedValue({ sub: 'u1', email: 'a@b.com' });
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer tok' }))).resolves.toBe(true);
    expect(fakeVerify).toHaveBeenCalledWith('tok');
  });

  it('accepts a valid ?token= query param (EventSource compat)', async () => {
    fakeVerify.mockResolvedValue({ sub: 'u1', email: 'a@b.com' });
    await expect(guard.canActivate(makeCtx({ query: { token: 'qtok' } }))).resolves.toBe(true);
    expect(fakeVerify).toHaveBeenCalledWith('qtok');
  });

  it('prefers Bearer header over query param when both present', async () => {
    fakeVerify.mockResolvedValue({ sub: 'u1', email: 'a@b.com' });
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer head', query: { token: 'qtok' } }))).resolves.toBe(true);
    expect(fakeVerify).toHaveBeenCalledWith('head');
  });

  it('rejects when no token provided', async () => {
    await expect(guard.canActivate(makeCtx())).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired query token', async () => {
    fakeVerify.mockRejectedValue(new Error('jwt expired'));
    await expect(guard.canActivate(makeCtx({ query: { token: 'expired' } }))).rejects.toThrow(UnauthorizedException);
  });
});
