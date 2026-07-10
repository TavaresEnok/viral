import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { sanitizeUser } from '@viralforge/shared';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BruteForceStore, RedisBruteForceStore } from './brute-force.store.js';
import { EmailService } from './email.service.js';
import type { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto.js';

const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000;
const BRUTE_FORCE_LOCK_MS = 15 * 60 * 1000;
const BRUTE_FORCE_MAX_ATTEMPTS = 10;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_DAYS = 7;
const EMAIL_VERIFY_HOURS = 24;
const PASSWORD_RESET_HOURS = 1;

export interface AuthTokenPair {
  refreshToken: string;
  refreshExpiresAt: Date;
}

function webOrigin() {
  return (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim() || 'http://localhost:3000';
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly bruteForceStore: BruteForceStore;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {
    this.bruteForceStore = new RedisBruteForceStore(
      Number(process.env.BRUTE_FORCE_MAX_ATTEMPTS ?? BRUTE_FORCE_MAX_ATTEMPTS),
      Number(process.env.BRUTE_FORCE_WINDOW_MS ?? BRUTE_FORCE_WINDOW_MS),
      Number(process.env.BRUTE_FORCE_LOCK_MS ?? BRUTE_FORCE_LOCK_MS),
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase(),
        passwordHash,
        // emailVerified inicia como false
        quota: {
          create: {
            plan: 'free',
            maxProjectMinutesPerMonth: 60,
            maxRendersPerMonth: 20,
            maxProjectsPerMonth: 5,
          },
        },
      },
    });

    // Envia e-mail de verificação de forma assíncrona (sem bloquear o registro)
    this.sendVerificationEmail(user.id, user.email, user.name).catch((err) =>
      this.logger.error({ msg: 'Falha ao enviar e-mail de verificação pós-registro', error: err instanceof Error ? err.message : String(err) }),
    );

    await this.audit.record({ userId: user.id, action: 'auth.register' });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto, ip: string) {
    const email = dto.email.toLowerCase();
    const key = `login:${email}:${ip}`;
    await this.checkBruteForce(key);

    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!valid) {
      await this.recordFailedAttempt(key);
      await this.audit.record({ action: 'auth.login_failed', ip, metadata: { email } });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.suspended) {
      await this.audit.record({ userId: user.id, action: 'auth.login_suspended', ip });
      throw new ForbiddenException('Conta suspensa. Fale com o suporte.');
    }

    await this.bruteForceStore.clear(key);
    await this.audit.record({ userId: user.id, action: 'auth.login', ip });
    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Sessão expirada');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ userId: stored.userId, action: 'auth.refresh_reuse_detected' });
      throw new UnauthorizedException('Sessão revogada');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.buildAuthResponse(stored.user, stored.family);
  }

  async logout(refreshToken: string | undefined, userId?: string) {
    if (refreshToken) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: this.hashToken(refreshToken) },
        select: { userId: true },
      });
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ userId: stored?.userId ?? null, action: 'auth.logout' });
      return { ok: true };
    }

    if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ userId, action: 'auth.logout' });
    }
    return { ok: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({ userId, action: 'auth.logout_all' });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: { name?: string; email?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const data: { name?: string; email?: string; emailVerified?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      if (email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('E-mail já está em uso');
        data.email = email;
        data.emailVerified = false; // trocou e-mail: precisa verificar de novo
      }
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.record({ userId, action: 'auth.profile_update' });
    if (data.email) {
      this.sendVerificationEmail(updated.id, updated.email, updated.name).catch(() => null);
    }
    return sanitizeUser(updated);
  }

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Senha atual incorreta');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Revoga as outras sessões por segurança.
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({ userId, action: 'auth.password_change' });
    return { ok: true };
  }

  // ─── E-mail Verification ─────────────────────────────────────────────────

  async sendVerificationEmail(userId: string, userEmail: string, userName: string) {
    // Invalida tokens anteriores do mesmo tipo
    await this.prisma.emailToken.updateMany({
      where: { userId, type: 'VERIFY_EMAIL', usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_HOURS * 60 * 60 * 1000);

    await this.prisma.emailToken.create({
      data: { userId, type: 'VERIFY_EMAIL', tokenHash, expiresAt },
    });

    const verifyUrl = `${webOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: userEmail,
      subject: 'Confirme seu e-mail — ViralForge',
      html: this.email.buildVerifyEmailHtml(userName, verifyUrl),
    });

    this.logger.log({ msg: 'E-mail de verificação enviado', userId });
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = this.hashToken(dto.token);
    const record = await this.prisma.emailToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.type !== 'VERIFY_EMAIL') {
      throw new BadRequestException('Token de verificação inválido');
    }
    if (record.usedAt) {
      throw new BadRequestException('Este link já foi utilizado');
    }
    if (record.expiresAt <= new Date()) {
      throw new BadRequestException('Link de verificação expirado. Solicite um novo e-mail de confirmação');
    }

    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    ]);

    await this.audit.record({ userId: record.userId, action: 'auth.email_verified' });
    return { ok: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.emailVerified) {
      throw new BadRequestException('E-mail já verificado');
    }

    // Rate-limit: um reenvio a cada 2 minutos
    const recent = await this.prisma.emailToken.findFirst({
      where: {
        userId,
        type: 'VERIFY_EMAIL',
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });
    if (recent) {
      throw new HttpException('Aguarde 2 minutos antes de solicitar outro e-mail de verificação', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.sendVerificationEmail(userId, user.email, user.name);
    return { ok: true };
  }

  // ─── Password Reset ───────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });

    // Sempre retorna sucesso (não revela se e-mail existe)
    if (!user) return { ok: true };

    // Rate-limit: um reset a cada 5 minutos
    const recent = await this.prisma.emailToken.findFirst({
      where: {
        userId: user.id,
        type: 'RESET_PASSWORD',
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recent) return { ok: true }; // Silencia para não revelar

    // Invalida tokens anteriores
    await this.prisma.emailToken.updateMany({
      where: { userId: user.id, type: 'RESET_PASSWORD', usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000);

    await this.prisma.emailToken.create({
      data: { userId: user.id, type: 'RESET_PASSWORD', tokenHash, expiresAt },
    });

    const resetUrl = `${webOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: user.email,
      subject: 'Redefinir senha — ViralForge',
      html: this.email.buildResetPasswordHtml(user.name, resetUrl),
    });

    await this.audit.record({ userId: user.id, action: 'auth.forgot_password' });
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const record = await this.prisma.emailToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.type !== 'RESET_PASSWORD') {
      throw new BadRequestException('Token de redefinição inválido ou já utilizado');
    }
    if (record.usedAt) {
      throw new BadRequestException('Este link já foi utilizado');
    }
    if (record.expiresAt <= new Date()) {
      throw new BadRequestException('Link expirado. Solicite uma nova redefinição de senha');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // Revoga todas as sessões ativas
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({ userId: record.userId, action: 'auth.password_reset' });
    return { ok: true };
  }

  async onModuleDestroy() {
    const destroyable = this.bruteForceStore as BruteForceStore & { onModuleDestroy?: () => Promise<void> | void };
    await destroyable.onModuleDestroy?.();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async checkBruteForce(key: string) {
    const state = await this.bruteForceStore.check(key);
    if (state.locked) {
      throw new HttpException(
        `Muitas tentativas. Tente novamente em ${state.remainingSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedAttempt(key: string) {
    const result = await this.bruteForceStore.recordFailure(key);
    if (result.locked) {
      const keyHash = createHash('sha256').update(key).digest('hex').slice(0, 16);
      this.logger.warn({ msg: 'Brute force lockout', keyHash, attempts: result.count, store: result.source });
    }
  }

  private async buildAuthResponse(user: Awaited<ReturnType<PrismaService['user']['create']>>, family: string = randomUUID()) {
    const token = await this.jwtService.signAsync({ sub: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_TTL });
    const refresh = await this.createRefreshToken(user.id, family);
    return { user: sanitizeUser(user), token, refreshToken: refresh.refreshToken, refreshExpiresAt: refresh.refreshExpiresAt };
  }

  private async createRefreshToken(userId: string, family: string): Promise<AuthTokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        family,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });
    return { refreshToken, refreshExpiresAt };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
