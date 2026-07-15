import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  encryptSecret,
  getMasterSecret,
  getYouTubeClientId,
  getYouTubeClientSecret,
  getYouTubeRedirectUri,
  getTikTokClientKey,
  getTikTokClientSecret,
  getTikTokRedirectUri,
  getInstagramAppId,
  getInstagramAppSecret,
  getInstagramRedirectUri,
  signOAuthState,
} from '@viralforge/shared';
import { Prisma, PublishStatus, SocialPlatform } from '@prisma/client';

// Categorias atribuídas pelo worker a clips gerados sem curadoria da IA
// (fallback operacional e modo offline). Ver clip-persistence.service.ts.
export const DEGRADED_CLIP_CATEGORIES = new Set(['fallback-review', 'offline-preview']);

const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const TIKTOK_SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];

const FB_GRAPH = 'https://graph.facebook.com/v22.0';
const FB_AUTH_URL = 'https://www.facebook.com/v22.0/dialog/oauth';
const INSTAGRAM_SCOPES = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'business_management'];

function getYouTubeConfig() {
  const clientId = getYouTubeClientId();
  const clientSecret = getYouTubeClientSecret();
  const redirectUri = getYouTubeRedirectUri();
  const masterSecret = getMasterSecret();
  if (!clientId || !clientSecret || !masterSecret) {
    throw new Error('YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e MASTER_SECRET são obrigatórios para integração com YouTube');
  }
  return { clientId, clientSecret, redirectUri, masterSecret };
}

function getTikTokConfig() {
  const clientKey = getTikTokClientKey();
  const clientSecret = getTikTokClientSecret();
  const redirectUri = getTikTokRedirectUri();
  const masterSecret = getMasterSecret();
  if (!clientKey || !clientSecret || !masterSecret) {
    throw new Error('TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET e MASTER_SECRET são obrigatórios para integração com TikTok');
  }
  return { clientKey, clientSecret, redirectUri, masterSecret };
}

function getInstagramConfig() {
  const appId = getInstagramAppId();
  const appSecret = getInstagramAppSecret();
  const redirectUri = getInstagramRedirectUri();
  const masterSecret = getMasterSecret();
  if (!appId || !appSecret || !masterSecret) {
    throw new Error('INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET e MASTER_SECRET são obrigatórios para integração com Instagram');
  }
  return { appId, appSecret, redirectUri, masterSecret };
}

@Injectable()
export class PublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly audit: AuditService,
  ) {}

  async listAccounts(userId: string) {
    return this.prisma.socialAccount.findMany({
      where: { userId },
      select: { id: true, platform: true, platformAccountName: true, active: true, createdAt: true },
    });
  }

  async disconnectAccount(userId: string, accountId: string) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('Conta social não encontrada');
    await this.prisma.socialAccount.delete({ where: { id: accountId } });
    await this.audit.record({ userId, action: 'publish.disconnect_account', entityType: 'socialAccount', entityId: accountId, metadata: { platform: account.platform } });
  }

  async listPublishedClips(userId: string) {
    return this.prisma.publishedClip.findMany({
      where: {
        socialAccount: { userId },
      },
      include: {
        clip: { select: { id: true, projectId: true, title: true, duration: true, thumbnailPath: true } },
        socialAccount: { select: { id: true, platform: true, platformAccountName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listCalendar(
    userId: string,
    from?: string,
    to?: string,
    status?: PublishStatus,
    platform?: SocialPlatform,
  ) {
    const now = new Date();
    const rangeStart = from ? new Date(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rangeEnd = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd <= rangeStart) {
      throw new BadRequestException('Intervalo do calendário inválido');
    }
    if (rangeEnd.getTime() - rangeStart.getTime() > 370 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('O calendário aceita intervalos de até 370 dias');
    }

    const where: Prisma.PublishedClipWhereInput = {
      socialAccount: { userId },
      ...(status ? { status } : {}),
      ...(platform ? { platform } : {}),
      OR: [
        { scheduledAt: { gte: rangeStart, lt: rangeEnd } },
        { publishedAt: { gte: rangeStart, lt: rangeEnd } },
        {
          scheduledAt: null,
          publishedAt: null,
          createdAt: { gte: rangeStart, lt: rangeEnd },
        },
      ],
    };

    return this.prisma.publishedClip.findMany({
      where,
      include: {
        clip: { select: { id: true, projectId: true, title: true, duration: true, thumbnailPath: true } },
        socialAccount: { select: { id: true, platform: true, platformAccountName: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { publishedAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async reschedule(userId: string, publishedClipId: string, scheduledAt: string) {
    const parsedSchedule = new Date(scheduledAt);
    if (Number.isNaN(parsedSchedule.getTime()) || parsedSchedule <= new Date()) {
      throw new BadRequestException('A nova data de agendamento precisa ser válida e futura');
    }
    const item = await this.prisma.publishedClip.findFirst({
      where: { id: publishedClipId, socialAccount: { userId } },
      include: { clip: { select: { category: true } } },
    });
    if (!item) throw new NotFoundException('Publicação agendada não encontrada');
    if (item.status !== PublishStatus.PENDING || !item.scheduledAt) {
      throw new BadRequestException('Somente publicações pendentes e agendadas podem ser reagendadas');
    }
    if (DEGRADED_CLIP_CATEGORIES.has(item.clip.category)) {
      throw new BadRequestException('Cortes em modo degradado não podem ser agendados');
    }

    const updated = await this.prisma.publishedClip.updateMany({
      where: { id: item.id, status: PublishStatus.PENDING, scheduledAt: { not: null } },
      data: { scheduledAt: parsedSchedule },
    });
    if (updated.count === 0) throw new BadRequestException('A publicação já começou e não pode mais ser reagendada');
    await this.audit.record({
      userId,
      action: 'publish.reschedule_clip',
      entityType: 'publishedClip',
      entityId: item.id,
      metadata: { previousScheduledAt: item.scheduledAt.toISOString(), scheduledAt: parsedSchedule.toISOString() },
    });
    return this.prisma.publishedClip.findUnique({ where: { id: item.id } });
  }

  async cancelScheduled(userId: string, publishedClipId: string) {
    const item = await this.prisma.publishedClip.findFirst({
      where: { id: publishedClipId, socialAccount: { userId } },
    });
    if (!item) throw new NotFoundException('Publicação agendada não encontrada');
    if (item.status !== PublishStatus.PENDING || !item.scheduledAt) {
      throw new BadRequestException('Somente publicações pendentes e agendadas podem ser canceladas');
    }
    const removed = await this.prisma.publishedClip.deleteMany({
      where: { id: item.id, status: PublishStatus.PENDING, scheduledAt: { not: null } },
    });
    if (removed.count === 0) throw new BadRequestException('A publicação já começou e não pode mais ser cancelada');
    await this.audit.record({
      userId,
      action: 'publish.cancel_scheduled_clip',
      entityType: 'publishedClip',
      entityId: item.id,
      metadata: { scheduledAt: item.scheduledAt.toISOString(), platform: item.platform },
    });
    return { ok: true };
  }

  async publishClip(userId: string, clipId: string, socialAccountId: string, scheduledAt?: string) {
    const clip = await this.prisma.clip.findFirst({
      where: { id: clipId, project: { userId } },
    });
    if (!clip) throw new NotFoundException('Clip não encontrado');
    if (clip.status !== 'COMPLETED') {
      throw new BadRequestException('Clip precisa estar renderizado antes de publicar');
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId, active: true },
    });
    if (!account) throw new NotFoundException('Conta social não encontrada ou inativa');
    if (!clip.videoPath) throw new BadRequestException('Clip não possui arquivo de vídeo');

    const existing = await this.prisma.publishedClip.findFirst({
      where: { clipId, socialAccountId, status: { in: ['PENDING', 'PUBLISHING', 'PUBLISHED'] } },
    });
    if (existing) throw new BadRequestException('Clip já foi publicado ou está na fila');

    const parsedSchedule = scheduledAt ? new Date(scheduledAt) : null;
    if (parsedSchedule && Number.isNaN(parsedSchedule.getTime())) {
      throw new BadRequestException('Data de agendamento inválida');
    }
    if (parsedSchedule && parsedSchedule <= new Date()) {
      throw new BadRequestException('Data de agendamento precisa ser futura');
    }
    // Clips de modo degradado (fallback sem curadoria da IA) não podem ser
    // agendados: agendar é publicar sem olhar. Publicação imediata segue
    // permitida — o usuário está revisando o clip naquele momento.
    if (parsedSchedule && DEGRADED_CLIP_CATEGORIES.has(clip.category)) {
      throw new BadRequestException(
        'Este corte foi gerado em modo degradado (a IA não produziu cortes válidos). Revise e publique manualmente, ou reprocesse o projeto antes de agendar.',
      );
    }

    const published = await this.prisma.publishedClip.create({
      data: {
        clipId,
        socialAccountId,
        platform: account.platform,
        scheduledAt: parsedSchedule,
      },
    });

    if (!parsedSchedule) {
      await this.queueService.addPublishJob({
        jobType: 'PUBLISH_CLIP',
        projectId: clip.projectId,
        userId,
        clipId,
        socialAccountId,
        platform: account.platform,
      });
    }

    await this.audit.record({ userId, action: parsedSchedule ? 'publish.schedule_clip' : 'publish.clip', entityType: 'clip', entityId: clipId, metadata: { socialAccountId, platform: account.platform, scheduledAt: parsedSchedule?.toISOString() } });
    return published;
  }

  buildYouTubeAuthUrl(userId: string): string {
    const { clientId, redirectUri } = getYouTubeConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: YOUTUBE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: signOAuthState(userId),
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async handleYouTubeCallback(userId: string, code: string) {
    if (!code) throw new BadRequestException('Código de autorização não fornecido');
    const { clientId, clientSecret, redirectUri, masterSecret } = getYouTubeConfig();

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('Falha ao trocar código por token no YouTube');
    }

    const tokens: { access_token: string; refresh_token?: string; expires_in: number } = await tokenResponse.json();

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(12000),
    });

    let channelName = 'YouTube';
    let channelId = '';
    if (userInfoResponse.ok) {
      const userInfo: { name?: string; id?: string } = await userInfoResponse.json();
      channelName = userInfo.name ?? 'YouTube';
      channelId = userInfo.id ?? '';
    }

    const accessTokenEncrypted = encryptSecret(tokens.access_token, masterSecret);
    const refreshTokenEncrypted = tokens.refresh_token ? encryptSecret(tokens.refresh_token, masterSecret) : null;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const account = await this.prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: 'YOUTUBE' } },
      update: {
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        platformAccountName: channelName,
        platformAccountId: channelId,
        active: true,
      },
      create: {
        userId,
        platform: 'YOUTUBE',
        platformAccountName: channelName,
        platformAccountId: channelId,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        active: true,
      },
    });

    await this.audit.record({ userId, action: 'publish.connect_youtube', entityType: 'socialAccount', entityId: account.id, metadata: { channelName } });
    return { ok: true, channelName };
  }

  async connectTikTok(userId: string, accessToken: string, openId: string, username: string) {
    const masterSecret = getMasterSecret();
    if (!masterSecret) throw new Error('MASTER_SECRET não configurada');
    const accessTokenEncrypted = encryptSecret(accessToken, masterSecret);
    const account = await this.prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: 'TIKTOK' } },
      update: { accessTokenEncrypted, platformAccountName: username, platformAccountId: openId, active: true },
      create: { userId, platform: 'TIKTOK', accessTokenEncrypted, platformAccountName: username, platformAccountId: openId, active: true },
    });
    await this.audit.record({ userId, action: 'publish.connect_tiktok', entityType: 'socialAccount', entityId: account.id, metadata: { username, openId } });
    return { ok: true, username };
  }

  async connectInstagram(userId: string, accessToken: string, businessId: string, username: string) {
    const masterSecret = getMasterSecret();
    if (!masterSecret) throw new Error('MASTER_SECRET não configurada');
    const accessTokenEncrypted = encryptSecret(accessToken, masterSecret);
    const account = await this.prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: 'INSTAGRAM' } },
      update: { accessTokenEncrypted, platformAccountName: username, platformAccountId: businessId, active: true },
      create: { userId, platform: 'INSTAGRAM', accessTokenEncrypted, platformAccountName: username, platformAccountId: businessId, active: true },
    });
    await this.audit.record({ userId, action: 'publish.connect_instagram', entityType: 'socialAccount', entityId: account.id, metadata: { username, businessId } });
    return { ok: true, username };
  }

  // ─── TikTok OAuth (Login Kit) ───────────────────────────────────────────
  buildTikTokAuthUrl(userId: string): string {
    const { clientKey, redirectUri } = getTikTokConfig();
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: TIKTOK_SCOPES.join(','),
      redirect_uri: redirectUri,
      state: signOAuthState(userId),
    });
    return `${TIKTOK_AUTH_URL}?${params.toString()}`;
  }

  async handleTikTokCallback(userId: string, code: string): Promise<string> {
    if (!code) throw new BadRequestException('Código de autorização não fornecido');
    const { clientKey, clientSecret, redirectUri, masterSecret } = getTikTokConfig();

    const tokenResponse = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokens = (await tokenResponse.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      open_id?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokens.access_token || !tokens.open_id) {
      throw new BadRequestException(
        `Falha ao trocar código por token no TikTok: ${tokens.error_description ?? tokens.error ?? 'resposta inválida'}`,
      );
    }

    let displayName = 'TikTok';
    try {
      const infoRes = await fetch(`${TIKTOK_USERINFO_URL}?fields=open_id,display_name`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(12000),
      });
      if (infoRes.ok) {
        const info = (await infoRes.json()) as { data?: { user?: { display_name?: string } } };
        displayName = info.data?.user?.display_name ?? 'TikTok';
      }
    } catch {
      // nome é opcional
    }

    const accessTokenEncrypted = encryptSecret(tokens.access_token, masterSecret);
    const refreshTokenEncrypted = tokens.refresh_token ? encryptSecret(tokens.refresh_token, masterSecret) : null;
    const tokenExpiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    const account = await this.prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: 'TIKTOK' } },
      update: { accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, platformAccountName: displayName, platformAccountId: tokens.open_id, active: true },
      create: { userId, platform: 'TIKTOK', accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, platformAccountName: displayName, platformAccountId: tokens.open_id, active: true },
    });
    await this.audit.record({ userId, action: 'publish.connect_tiktok', entityType: 'socialAccount', entityId: account.id, metadata: { displayName } });
    return displayName;
  }

  // ─── Instagram OAuth (Facebook Login → IG Graph API) ────────────────────
  buildInstagramAuthUrl(userId: string): string {
    const { appId, redirectUri } = getInstagramConfig();
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: INSTAGRAM_SCOPES.join(','),
      state: signOAuthState(userId),
    });
    return `${FB_AUTH_URL}?${params.toString()}`;
  }

  async handleInstagramCallback(userId: string, code: string): Promise<string> {
    if (!code) throw new BadRequestException('Código de autorização não fornecido');
    const { appId, appSecret, redirectUri, masterSecret } = getInstagramConfig();

    // 1. code → token de curta duração
    const tokenRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString()}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const tokenData = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new BadRequestException(`Falha ao trocar código por token no Instagram: ${tokenData.error?.message ?? 'resposta inválida'}`);
    }

    // 2. troca por token de longa duração (60 dias)
    let userToken = tokenData.access_token;
    try {
      const llRes = await fetch(
        `${FB_GRAPH}/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: userToken }).toString()}`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (llRes.ok) {
        const ll = (await llRes.json()) as { access_token?: string };
        if (ll.access_token) userToken = ll.access_token;
      }
    } catch {
      // mantém o token de curta duração
    }

    // 3. acha a conta IG Business vinculada a uma Página do Facebook
    const pagesRes = await fetch(
      `${FB_GRAPH}/me/accounts?${new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: userToken }).toString()}`,
      { signal: AbortSignal.timeout(12000) },
    );
    const pagesData = (await pagesRes.json().catch(() => ({}))) as {
      data?: Array<{ access_token?: string; instagram_business_account?: { id?: string; username?: string } }>;
    };
    const page = (pagesData.data ?? []).find((p) => p.instagram_business_account?.id);
    if (!page?.instagram_business_account?.id) {
      throw new BadRequestException('Nenhuma conta Instagram Business vinculada a uma Página do Facebook. Vincule a conta e tente de novo.');
    }
    const igId = page.instagram_business_account.id;
    const username = page.instagram_business_account.username ?? 'Instagram';
    // O token da Página é o que publica no IG.
    const pageToken = page.access_token ?? userToken;

    const accessTokenEncrypted = encryptSecret(pageToken, masterSecret);
    const account = await this.prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: 'INSTAGRAM' } },
      update: { accessTokenEncrypted, platformAccountName: username, platformAccountId: igId, active: true },
      create: { userId, platform: 'INSTAGRAM', accessTokenEncrypted, platformAccountName: username, platformAccountId: igId, active: true },
    });
    await this.audit.record({ userId, action: 'publish.connect_instagram', entityType: 'socialAccount', entityId: account.id, metadata: { username } });
    return username;
  }

  async refreshYouTubeToken(userId: string, accountId: string) {
    const { clientId, clientSecret, masterSecret } = getYouTubeConfig();

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, userId, platform: 'YOUTUBE' },
    });
    if (!account) throw new NotFoundException('Conta YouTube não encontrada');
    if (!account.refreshTokenEncrypted) {
      throw new BadRequestException('Token de atualização não disponível');
    }

    const { decryptSecret } = await import('@viralforge/shared');
    const refreshToken = decryptSecret(account.refreshTokenEncrypted, masterSecret);
    if (!refreshToken) throw new UnauthorizedException('Não foi possível descriptografar o token');

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('Falha ao atualizar token do YouTube');
    }

    const tokens: { access_token: string; expires_in: number } = await tokenResponse.json();
    const accessTokenEncrypted = encryptSecret(tokens.access_token, masterSecret);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: { accessTokenEncrypted, tokenExpiresAt },
    });

    return { ok: true };
  }
}
