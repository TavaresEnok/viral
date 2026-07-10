export const VIDEO_PROCESSING_QUEUE = 'video-processing-queue';
export * from './secrets.js';
export * from './text.js';
export * from './config.js';
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export const ALLOWED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
];
export function sanitizeUser(user) {
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.deepseekApiKeyEncrypted;
    delete safeUser.openaiApiKeyEncrypted;
    return safeUser;
}
export function toPublicPath(path) {
    if (!path) {
        return null;
    }
    return path.replace(/\\/g, '/');
}
export function validateJobPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Payload deve ser um objeto' };
    }
    const obj = payload;
    if (typeof obj.projectId !== 'string' || !obj.projectId) {
        return { valid: false, error: 'projectId é obrigatório' };
    }
    if (typeof obj.userId !== 'string' || !obj.userId) {
        return { valid: false, error: 'userId é obrigatório' };
    }
    const jobType = obj.jobType;
    if (jobType === 'RENDER_CLIP') {
        if (typeof obj.clipId !== 'string' || !obj.clipId) {
            return { valid: false, error: 'clipId é obrigatório para RENDER_CLIP' };
        }
        return { valid: true, data: payload };
    }
    if (jobType === 'PUBLISH_CLIP') {
        if (typeof obj.clipId !== 'string' || !obj.clipId) {
            return { valid: false, error: 'clipId é obrigatório para PUBLISH_CLIP' };
        }
        if (typeof obj.socialAccountId !== 'string' || !obj.socialAccountId) {
            return { valid: false, error: 'socialAccountId é obrigatório para PUBLISH_CLIP' };
        }
        return { valid: true, data: payload };
    }
    if (!jobType || jobType === 'PROCESS_PROJECT') {
        return { valid: true, data: payload };
    }
    return { valid: false, error: `jobType inválido: ${String(jobType)}` };
}
