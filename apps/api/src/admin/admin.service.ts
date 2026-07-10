import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Queue } from 'bullmq';
import { REDIS_CONFIG, VIDEO_PROCESSING_QUEUE, encryptSecret, getMasterSecret } from '@viralforge/shared';
import { PLATFORM_AI_CONFIG_ID } from './platform-ai-config.constants.js';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { storageRoot } from '../common/safe-path.helper.js';
import { QUOTA_PLANS } from '../quota/plans.js';

const execFileAsync = promisify(execFile);

// Espelha os preços em pricing.service.ts (USD/mês). Mantenha em sincronia.
const PLAN_PRICE_USD: Record<string, number> = { free: 0, pro: 49, studio: 149 };

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

type GroupRow<K extends string> = Record<K, string> & { _count: { _all: number } };

function countByKey<K extends string>(rows: Array<GroupRow<K>>, key: K): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row[key], row._count._all]));
}

@Injectable()
export class AdminService implements OnModuleDestroy {
  private readonly queue = new Queue(VIDEO_PROCESSING_QUEUE, { connection: REDIS_CONFIG });

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleDestroy() {
    await this.queue.close();
  }

  async overview() {
    const now = Date.now();
    const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      verifiedUsers,
      adminUsers,
      newUsers7,
      newUsers30,
      quotaByPlan,
      activeQuotaByPlan,
      totalProjects,
      projectsByStatus,
      durationAgg,
      totalClips,
      clipsByStatus,
      totalPipelineRuns,
      failedPipelineRuns,
      recentFailures,
      storageBytes,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { isAdmin: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.userQuota.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.userQuota.groupBy({
        by: ['plan'],
        where: { subscriptionStatus: 'active' },
        _count: { _all: true },
      }),
      this.prisma.project.count(),
      this.prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.project.aggregate({ _sum: { durationSeconds: true } }),
      this.prisma.clip.count(),
      this.prisma.clip.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.pipelineRunMetric.count(),
      this.prisma.pipelineRunMetric.count({ where: { status: 'FAILED' } }),
      this.prisma.pipelineRunMetric.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, projectId: true, failedStage: true, createdAt: true },
      }),
      this.storageBytes(),
    ]);

    const planCounts = countByKey(quotaByPlan as Array<GroupRow<'plan'>>, 'plan');
    const activePlanCounts = countByKey(activeQuotaByPlan as Array<GroupRow<'plan'>>, 'plan');
    const clipStatusCounts = countByKey(clipsByStatus as Array<GroupRow<'status'>>, 'status');

    const mrr = Object.entries(activePlanCounts).reduce(
      (sum, [plan, count]) => sum + (PLAN_PRICE_USD[plan] ?? 0) * count,
      0,
    );
    const activeSubscriptions = Object.values(activePlanCounts).reduce((a, b) => a + b, 0);

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        unverified: totalUsers - verifiedUsers,
        admins: adminUsers,
        newLast7Days: newUsers7,
        newLast30Days: newUsers30,
        byPlan: planCounts,
      },
      revenue: {
        currency: 'USD',
        mrr,
        activeSubscriptions,
        activeByPlan: activePlanCounts,
      },
      content: {
        projects: totalProjects,
        projectsByStatus: countByKey(projectsByStatus as Array<GroupRow<'status'>>, 'status'),
        totalMinutesIngested: Math.round((durationAgg._sum.durationSeconds ?? 0) / 60),
        clips: totalClips,
        renderedClips: clipStatusCounts.COMPLETED ?? 0,
        clipsByStatus: clipStatusCounts,
      },
      storage: {
        bytes: storageBytes,
        humanReadable: storageBytes != null ? formatBytes(storageBytes) : null,
        root: storageRoot(),
      },
      pipeline: {
        runs: totalPipelineRuns,
        failed: failedPipelineRuns,
        failureRate: totalPipelineRuns
          ? Math.round((failedPipelineRuns / totalPipelineRuns) * 100)
          : 0,
        recentFailures,
      },
    };
  }

  /** Top usuários por consumo (cortes gerados). Join Clip→Project, agrega por dono. */
  async topUsers(limit = 8) {
    const take = Math.max(1, Math.min(limit, 50));
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ userId: string; clips: number; projects: number }>
    >(
      `SELECT p."userId" AS "userId",
              COUNT(c.id)::int AS clips,
              COUNT(DISTINCT p.id)::int AS projects
       FROM "Clip" c
       JOIN "Project" p ON p.id = c."projectId"
       GROUP BY p."userId"
       ORDER BY clips DESC
       LIMIT ${take}`,
    );

    const ids = rows.map((row) => row.userId);
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true, quota: { select: { plan: true } } },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      users: rows.map((row) => {
        const user = byId.get(row.userId);
        return {
          id: row.userId,
          name: user?.name ?? null,
          email: user?.email ?? '—',
          plan: user?.quota?.plan ?? 'free',
          clips: Number(row.clips),
          projects: Number(row.projects),
        };
      }),
    };
  }

  /** Lista paginada de usuários (gerenciamento). */
  async users(params: { page?: number; search?: string }) {
    const pageSize = 25;
    const page = Math.max(1, params.page ?? 1);
    const search = params.search?.trim();
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          isAdmin: true,
          suspended: true,
          createdAt: true,
          quota: {
            select: {
              plan: true,
              subscriptionStatus: true,
              monthlyRenders: true,
              maxRendersPerMonth: true,
            },
          },
          _count: { select: { projects: true } },
        },
      }),
    ]);

    // Soma de clips por usuário (uma query para a página atual).
    const userIds = rows.map((row) => row.id);
    const projects = userIds.length
      ? await this.prisma.project.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, _count: { select: { clips: true } } },
        })
      : [];
    const clipsByUser = projects.reduce<Record<string, number>>((acc, p) => {
      acc[p.userId] = (acc[p.userId] ?? 0) + p._count.clips;
      return acc;
    }, {});

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      users: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified,
        isAdmin: row.isAdmin,
        suspended: row.suspended,
        createdAt: row.createdAt,
        plan: row.quota?.plan ?? 'free',
        subscriptionStatus: row.quota?.subscriptionStatus ?? 'inactive',
        rendersUsed: row.quota?.monthlyRenders ?? 0,
        rendersLimit: row.quota?.maxRendersPerMonth ?? 0,
        projects: row._count.projects,
        clips: clipsByUser[row.id] ?? 0,
      })),
    };
  }

  /** Métricas financeiras (assinaturas e receita). */
  async financial() {
    const [activeByPlan, byStatus, recent] = await Promise.all([
      this.prisma.userQuota.groupBy({
        by: ['plan'],
        where: { subscriptionStatus: 'active' },
        _count: { _all: true },
      }),
      this.prisma.userQuota.groupBy({
        by: ['subscriptionStatus'],
        _count: { _all: true },
      }),
      this.prisma.userQuota.findMany({
        where: { stripeSubscriptionId: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        select: {
          plan: true,
          subscriptionStatus: true,
          updatedAt: true,
          user: { select: { email: true, name: true } },
        },
      }),
    ]);

    const activePlanCounts = countByKey(activeByPlan as Array<GroupRow<'plan'>>, 'plan');
    const mrrByPlan = Object.fromEntries(
      Object.entries(activePlanCounts).map(([plan, count]) => [
        plan,
        (PLAN_PRICE_USD[plan] ?? 0) * count,
      ]),
    );
    const mrr = Object.values(mrrByPlan).reduce((a, b) => a + b, 0);
    const activeSubscriptions = Object.values(activePlanCounts).reduce((a, b) => a + b, 0);

    return {
      currency: 'USD',
      mrr,
      arr: mrr * 12,
      arpu: activeSubscriptions ? Math.round((mrr / activeSubscriptions) * 100) / 100 : 0,
      activeSubscriptions,
      activeByPlan: activePlanCounts,
      mrrByPlan,
      subscriptionsByStatus: countByKey(
        byStatus as Array<GroupRow<'subscriptionStatus'>>,
        'subscriptionStatus',
      ),
      planPrices: PLAN_PRICE_USD,
      recent: recent.map((row) => ({
        email: row.user.email,
        name: row.user.name,
        plan: row.plan,
        status: row.subscriptionStatus,
        updatedAt: row.updatedAt,
      })),
    };
  }

  /** Conteúdo: projetos/vídeos de todos os usuários (edições). */
  async content(params: { page?: number; status?: string }) {
    const pageSize = 25;
    const page = Math.max(1, params.page ?? 1);
    const where = params.status ? { status: params.status as never } : {};

    const [total, rows, byStatus] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          durationSeconds: true,
          contentType: true,
          user: { select: { email: true } },
          _count: { select: { clips: true } },
        },
      }),
      this.prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      byStatus: countByKey(byStatus as Array<GroupRow<'status'>>, 'status'),
      projects: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        contentType: row.contentType,
        ownerEmail: row.user.email,
        createdAt: row.createdAt,
        durationMinutes: row.durationSeconds ? Math.round(row.durationSeconds / 60) : null,
        clips: row._count.clips,
      })),
    };
  }

  // ─── Gerenciamento de usuários (ações) ───────────────────────────────────

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async setAdmin(actorId: string, userId: string, value: boolean, ip?: string) {
    if (userId === actorId && !value) {
      throw new BadRequestException('Você não pode remover o próprio acesso admin.');
    }
    await this.requireUser(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { isAdmin: value } });
    await this.audit.record({
      userId: actorId,
      action: 'admin.user.set_admin',
      entityType: 'user',
      entityId: userId,
      ip,
      metadata: { value },
    });
    return { ok: true };
  }

  async setSuspended(actorId: string, userId: string, value: boolean, ip?: string) {
    if (userId === actorId) {
      throw new BadRequestException('Você não pode suspender a própria conta.');
    }
    await this.requireUser(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { suspended: value } });
    if (value) {
      // Revoga sessões ativas para derrubar o usuário suspenso imediatamente.
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      userId: actorId,
      action: value ? 'admin.user.suspend' : 'admin.user.unsuspend',
      entityType: 'user',
      entityId: userId,
      ip,
    });
    return { ok: true };
  }

  async setPlan(actorId: string, userId: string, plan: string, ip?: string) {
    const limits = QUOTA_PLANS[plan];
    if (!limits) throw new BadRequestException(`Plano inválido: ${plan}`);
    await this.requireUser(userId);
    await this.prisma.userQuota.upsert({
      where: { userId },
      update: {
        plan,
        maxProjectsPerMonth: limits.maxProjects,
        maxProjectMinutesPerMonth: limits.maxMinutes,
        maxRendersPerMonth: limits.maxRenders,
      },
      create: {
        userId,
        plan,
        maxProjectsPerMonth: limits.maxProjects,
        maxProjectMinutesPerMonth: limits.maxMinutes,
        maxRendersPerMonth: limits.maxRenders,
      },
    });
    await this.audit.record({
      userId: actorId,
      action: 'admin.user.set_plan',
      entityType: 'user',
      entityId: userId,
      ip,
      metadata: { plan },
    });
    return { ok: true };
  }

  async verifyUserEmail(actorId: string, userId: string, ip?: string) {
    await this.requireUser(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    await this.audit.record({
      userId: actorId,
      action: 'admin.user.verify_email',
      entityType: 'user',
      entityId: userId,
      ip,
    });
    return { ok: true };
  }

  async userDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isAdmin: true,
        suspended: true,
        createdAt: true,
        quota: true,
        _count: { select: { projects: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        _count: { select: { clips: true } },
      },
    });
    const totalClips = projects.reduce((sum, p) => sum + p._count.clips, 0);
    return {
      user,
      recentProjects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        createdAt: p.createdAt,
        clips: p._count.clips,
      })),
      recentClips: totalClips,
    };
  }

  // ─── Operação / Controle ─────────────────────────────────────────────────

  async queueStatus() {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
      'paused',
    );
    return { queue: VIDEO_PROCESSING_QUEUE, counts };
  }

  async stuckProjects(minutes = 30) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const rows = await this.prisma.project.findMany({
      where: { status: 'PROCESSING', updatedAt: { lt: cutoff } },
      orderBy: { updatedAt: 'asc' },
      take: 50,
      select: {
        id: true,
        title: true,
        progress: true,
        updatedAt: true,
        user: { select: { email: true } },
      },
    });
    return {
      thresholdMinutes: minutes,
      projects: rows.map((p) => ({
        id: p.id,
        title: p.title,
        progress: p.progress,
        stuckSince: p.updatedAt,
        ownerEmail: p.user.email,
      })),
    };
  }

  async requeueProject(actorId: string, projectId: string, ip?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, originalFilePath: true, sourceUrl: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'PROCESSING', progress: 5, errorMessage: null },
    });
    const payload: Record<string, unknown> = {
      jobType: 'PROCESS_PROJECT',
      projectId: project.id,
      userId: project.userId,
    };
    if (project.originalFilePath) payload.originalFilePath = project.originalFilePath;
    if (project.sourceUrl) payload.sourceUrl = project.sourceUrl;
    await this.queue.add('process-video', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `admin-requeue:${projectId}:${Date.now()}`,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    });
    await this.audit.record({
      userId: actorId,
      action: 'admin.project.requeue',
      entityType: 'project',
      entityId: projectId,
      ip,
    });
    return { ok: true };
  }

  async cancelProject(actorId: string, projectId: string, ip?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'FAILED', errorMessage: 'Cancelado pelo administrador.' },
    });
    await this.audit.record({
      userId: actorId,
      action: 'admin.project.cancel',
      entityType: 'project',
      entityId: projectId,
      ip,
    });
    return { ok: true };
  }

  /** Série diária de novos usuários/projetos nos últimos 30 dias + acumulado. */
  async growth() {
    const days = 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [users, projects, baseline] = await Promise.all([
      this.prisma.user.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
      this.prisma.project.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
      this.prisma.user.count({ where: { createdAt: { lt: start } } }),
    ]);

    const dayKey = (date: Date) => date.toISOString().slice(0, 10);
    const usersByDay: Record<string, number> = {};
    const projectsByDay: Record<string, number> = {};
    for (const user of users) usersByDay[dayKey(user.createdAt)] = (usersByDay[dayKey(user.createdAt)] ?? 0) + 1;
    for (const project of projects) projectsByDay[dayKey(project.createdAt)] = (projectsByDay[dayKey(project.createdAt)] ?? 0) + 1;

    const series: Array<{ date: string; newUsers: number; newProjects: number; totalUsers: number }> = [];
    let cumulative = baseline;
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dayKey(date);
      const newUsers = usersByDay[key] ?? 0;
      cumulative += newUsers;
      series.push({ date: key, newUsers, newProjects: projectsByDay[key] ?? 0, totalUsers: cumulative });
    }
    return { days, series };
  }

  /** Trilha de auditoria (quem fez o quê). Default: apenas ações admin.*. */
  async auditTrail(params: { page?: number; scope?: string }) {
    const pageSize = 30;
    const page = Math.max(1, params.page ?? 1);
    const where = params.scope === 'all' ? {} : { action: { startsWith: 'admin.' } };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ip: true,
          metadata: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      entries: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorEmail: row.user?.email ?? null,
        entityType: row.entityType,
        entityId: row.entityId,
        ip: row.ip,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
    };
  }

  // ─── Configuração global de IA (admin controla a IA da plataforma) ───────

  async getAiConfig() {
    const config = await this.prisma.platformAiConfig.findUnique({ where: { id: PLATFORM_AI_CONFIG_ID } });
    return {
      llmActive: config?.llmActive ?? false,
      llmProvider: config?.llmProvider ?? '',
      llmModel: config?.llmModel ?? '',
      llmBaseUrl: config?.llmBaseUrl ?? '',
      llmKeySet: Boolean(config?.llmApiKeyEncrypted),
      transcriptionActive: config?.transcriptionActive ?? false,
      transcriptionProvider: config?.transcriptionProvider ?? '',
      transcriptionModel: config?.transcriptionModel ?? '',
      transcriptionBaseUrl: config?.transcriptionBaseUrl ?? '',
      transcriptionKeySet: Boolean(config?.transcriptionApiKeyEncrypted),
    };
  }

  async setAiConfig(
    actorId: string,
    dto: {
      llmActive?: boolean;
      llmProvider?: string;
      llmModel?: string;
      llmBaseUrl?: string;
      llmApiKey?: string;
      transcriptionActive?: boolean;
      transcriptionProvider?: string;
      transcriptionModel?: string;
      transcriptionBaseUrl?: string;
      transcriptionApiKey?: string;
    },
    ip?: string,
  ) {
    const masterSecret = getMasterSecret();
    if (!masterSecret) throw new BadRequestException('MASTER_SECRET não configurada.');

    // Chave só é re-gravada se uma nova for enviada (campo vazio mantém a atual).
    const llmKeyUpdate = dto.llmApiKey
      ? { llmApiKeyEncrypted: encryptSecret(dto.llmApiKey, masterSecret) }
      : {};
    const transcriptionKeyUpdate = dto.transcriptionApiKey
      ? { transcriptionApiKeyEncrypted: encryptSecret(dto.transcriptionApiKey, masterSecret) }
      : {};

    const data = {
      llmActive: dto.llmActive ?? false,
      llmProvider: dto.llmProvider ?? null,
      llmModel: dto.llmModel ?? null,
      llmBaseUrl: dto.llmBaseUrl ?? null,
      transcriptionActive: dto.transcriptionActive ?? false,
      transcriptionProvider: dto.transcriptionProvider ?? null,
      transcriptionModel: dto.transcriptionModel ?? null,
      transcriptionBaseUrl: dto.transcriptionBaseUrl ?? null,
      ...llmKeyUpdate,
      ...transcriptionKeyUpdate,
    };

    await this.prisma.platformAiConfig.upsert({
      where: { id: PLATFORM_AI_CONFIG_ID },
      update: data,
      create: { id: PLATFORM_AI_CONFIG_ID, ...data },
    });
    await this.audit.record({
      userId: actorId,
      action: 'admin.ai_config.update',
      entityType: 'platform_ai_config',
      entityId: PLATFORM_AI_CONFIG_ID,
      ip,
      metadata: { llmActive: data.llmActive, llmModel: data.llmModel, transcriptionActive: data.transcriptionActive },
    });
    return { ok: true };
  }

  /** Uso de disco do diretório de storage. Linux (du); null se indisponível. */
  private async storageBytes(): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync('du', ['-sb', storageRoot()], {
        timeout: 15000,
        maxBuffer: 4 * 1024 * 1024,
      });
      const bytes = Number(stdout.split(/\s/)[0]);
      return Number.isFinite(bytes) ? bytes : null;
    } catch {
      return null;
    }
  }
}
