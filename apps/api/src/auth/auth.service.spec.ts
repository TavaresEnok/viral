import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password'), compare: vi.fn() },
}));

const mockPrisma = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  refreshToken: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  emailToken: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  userQuota: { create: vi.fn() },
  $transaction: vi.fn().mockResolvedValue([]),
};
const mockAudit = { record: vi.fn() };
const mockJwt = { signAsync: vi.fn().mockResolvedValue('mock-access-token') };
const mockEmail = { send: vi.fn().mockResolvedValue(undefined), buildVerifyEmailHtml: vi.fn().mockReturnValue(''), buildResetPasswordHtml: vi.fn().mockReturnValue('') };

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  createdAt: new Date('2025-01-01'),
};

const mockRefreshToken = {
  id: 'rt-1',
  userId: 'user-1',
  family: 'family-1',
  tokenHash: 'hash',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  user: mockUser,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.REDIS_BRUTE_FORCE_ENABLED = 'false';

    service = new AuthService(
      mockPrisma as never,
      mockJwt as unknown as JwtService,
      mockAudit as never,
      mockEmail as never,
    );
  });

  describe('login', () => {
    it('succeeds with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const bcrypt = await import('bcryptjs');
      vi.mocked(bcrypt.default.compare).mockResolvedValue(true as never);

      const result = await service.login({ email: 'test@example.com', password: 'correct' }, '127.0.0.1');

      expect(result.user).toBeDefined();
      expect(result.token).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login' }));
    });

    it('throws on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const bcrypt = await import('bcryptjs');
      vi.mocked(bcrypt.default.compare).mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAudit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
    });

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'any' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('creates user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Str0ng!Pass',
      });

      expect(result.user).toBeDefined();
      expect(result.token).toBe('mock-access-token');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.register' }));
    });

    it('throws ConflictException on duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({ name: 'Test', email: 'test@example.com', password: 'Str0ng!Pass' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('refresh', () => {
    it('succeeds with valid token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);

      const result = await service.refresh('valid-refresh-token');

      expect(result.token).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws on missing token', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('throws on expired token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshToken,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('revokes family on reuse detection', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.refresh_reuse_detected' }));
    });
  });

  describe('logout', () => {
    it('revokes by token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({ userId: 'user-1' });

      const result = await service.logout('some-token');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.logout' }));
    });

    it('revokes by userId when no token', async () => {
      const result = await service.logout(undefined, 'user-1');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('returns ok with no token and no userId', async () => {
      const result = await service.logout(undefined, undefined);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('logoutAll', () => {
    it('revokes all tokens for user', async () => {
      const result = await service.logoutAll('user-1');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.logout_all' }));
    });
  });
});
