import { createCipheriv, createDecipheriv, createHash, randomBytes, createHmac } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const STATE_TTL_MS = 10 * 60 * 1000;

function getKey(masterSecret: string): Buffer {
  return createHash('sha256').update(masterSecret).digest();
}

export function getMasterSecret(): string {
  const secret = process.env.MASTER_SECRET ?? process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('MASTER_SECRET ou API_KEY_ENCRYPTION_SECRET não configurada');
  }
  return secret;
}

export function getYouTubeClientId(): string {
  return process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '';
}

export function getYouTubeClientSecret(): string {
  return process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '';
}

export function getYouTubeRedirectUri(): string {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
  return (
    process.env.YOUTUBE_REDIRECT_URI ??
    process.env.GOOGLE_REDIRECT_URI ??
    `${apiBase}/publish/youtube/callback`
  );
}

// TikTok (Login Kit + Content Posting API)
export function getTikTokClientKey(): string {
  return process.env.TIKTOK_CLIENT_KEY ?? '';
}

export function getTikTokClientSecret(): string {
  return process.env.TIKTOK_CLIENT_SECRET ?? '';
}

export function getTikTokRedirectUri(): string {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
  return process.env.TIKTOK_REDIRECT_URI ?? `${apiBase}/publish/tiktok/callback`;
}

// Instagram (via Facebook Login → Instagram Graph API)
export function getInstagramAppId(): string {
  return process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID ?? '';
}

export function getInstagramAppSecret(): string {
  return process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? '';
}

export function getInstagramRedirectUri(): string {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
  return process.env.INSTAGRAM_REDIRECT_URI ?? `${apiBase}/publish/instagram/callback`;
}

/** Primeira origem do WEB_ORIGIN — usada p/ redirecionar de volta ao app após OAuth. */
export function getWebOrigin(): string {
  return (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0]!.trim();
}

export function encryptSecret(value: string, masterSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(masterSecret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value: string | null | undefined, masterSecret: string): string | null {
  if (!value) {
    return null;
  }

  const [ivHex, tagHex, encryptedHex] = value.split(':');
  if (!ivHex || !tagHex || !encryptedHex) {
    return null;
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(masterSecret), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function signOAuthState(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET é obrigatório para assinar state OAuth');
  const ts = Date.now().toString(36);
  const hmac = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex').slice(0, 12);
  return `${userId}.${ts}.${hmac}`;
}

export function verifyOAuthState(state: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET é obrigatório para verificar state OAuth');
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, hmac] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex').slice(0, 12);
  if (hmac !== expected) return null;
  const timestamp = parseInt(ts, 36);
  if (Date.now() - timestamp > STATE_TTL_MS) return null;
  return userId;
}
