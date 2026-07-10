import { createCipheriv, createDecipheriv, createHash, randomBytes, createHmac } from 'node:crypto';
const ALGORITHM = 'aes-256-gcm';
const STATE_TTL_MS = 10 * 60 * 1000;
function getKey(masterSecret) {
    return createHash('sha256').update(masterSecret).digest();
}
export function getMasterSecret() {
    const secret = process.env.MASTER_SECRET ?? process.env.API_KEY_ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error('MASTER_SECRET ou API_KEY_ENCRYPTION_SECRET não configurada');
    }
    return secret;
}
export function getYouTubeClientId() {
    return process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '';
}
export function getYouTubeClientSecret() {
    return process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '';
}
export function getYouTubeRedirectUri() {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    return (process.env.YOUTUBE_REDIRECT_URI ??
        process.env.GOOGLE_REDIRECT_URI ??
        `${apiBase}/publish/youtube/callback`);
}
export function encryptSecret(value, masterSecret) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, getKey(masterSecret), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
export function decryptSecret(value, masterSecret) {
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
export function signOAuthState(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET é obrigatório para assinar state OAuth');
    const ts = Date.now().toString(36);
    const hmac = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex').slice(0, 12);
    return `${userId}.${ts}.${hmac}`;
}
export function verifyOAuthState(state) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET é obrigatório para verificar state OAuth');
    const parts = state.split('.');
    if (parts.length !== 3)
        return null;
    const [userId, ts, hmac] = parts;
    const expected = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex').slice(0, 12);
    if (hmac !== expected)
        return null;
    const timestamp = parseInt(ts, 36);
    if (Date.now() - timestamp > STATE_TTL_MS)
        return null;
    return userId;
}
