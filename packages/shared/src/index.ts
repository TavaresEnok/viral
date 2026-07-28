export const VIDEO_PROCESSING_QUEUE = 'video-processing-queue';
export * from './secrets.js';
export * from './text.js';
export * from './config.js';

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
] as const;

export type ProjectStatus = 'DRAFT' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ContentType =
  | 'PODCAST'
  | 'INTERVIEW'
  | 'CLASS'
  | 'LIVE'
  | 'TALK'
  | 'COMEDY'
  | 'GAMING'
  | 'MYSTERY'
  | 'NEWS'
  | 'OTHER';
export type ClipStyle =
  | 'VIRAL'
  | 'EDUCATIONAL'
  | 'CONTROVERSIAL'
  | 'FUNNY'
  | 'MOTIVATIONAL'
  | 'SALES'
  | 'STRONG_QUOTES';

export type QueueJobPayload =
  | {
      jobType?: 'PROCESS_PROJECT';
      projectId: string;
      userId: string;
      originalFilePath?: string;
      sourceUrl?: string;
    }
  | {
      jobType: 'RENDER_CLIP';
      projectId: string;
      userId: string;
      clipId: string;
      /** When set, renders only the first N seconds of the clip (preview mode). */
      previewSeconds?: number;
      /** When true, enables automatic emoji/SFX overlays (requires Remotion engine). */
      autoOverlays?: boolean;
    }
  | {
      /**
       * Regera a legenda de UM corte com ASR (whisper local), substituindo a
       * legenda herdada da transcrição do projeto (que pode vir do YouTube).
       * Não renderiza: o usuário revisa o texto antes de gastar um render.
       */
      jobType: 'RETRANSCRIBE_CLIP';
      projectId: string;
      userId: string;
      clipId: string;
    }
  | {
      jobType: 'PUBLISH_CLIP';
      projectId: string;
      userId: string;
      clipId: string;
      socialAccountId: string;
      platform: string;
    }
  | {
      /**
       * Renderiza UM item do editor em massa: legenda digitada manualmente,
       * sem transcrição/IA. Não tem projectId — não pertence a nenhum Project.
       */
      jobType: 'RENDER_BULK_ITEM';
      userId: string;
      itemId: string;
    }
  | {
      /**
       * Lista os vídeos públicos de um canal/perfil (TikTok/Instagram/Kwai)
       * sem baixar nada ainda. Resultado salvo em ChannelImportRequest.videosJson.
       */
      jobType: 'LIST_CHANNEL_VIDEOS';
      userId: string;
      requestId: string;
    };

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: ApiUser;
  token: string;
}

export function sanitizeUser<
  T extends {
    passwordHash?: unknown;
    deepseekApiKeyEncrypted?: unknown;
    openaiApiKeyEncrypted?: unknown;
  },
>(user: T): Omit<T, 'passwordHash' | 'deepseekApiKeyEncrypted' | 'openaiApiKeyEncrypted'> {
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.deepseekApiKeyEncrypted;
  delete safeUser.openaiApiKeyEncrypted;
  return safeUser;
}

export function toPublicPath(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  return path.replace(/\\/g, '/');
}

export function validateJobPayload(
  payload: unknown,
): { valid: true; data: QueueJobPayload } | { valid: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload deve ser um objeto' };
  }

  const obj = payload as Record<string, unknown>;

  if (typeof obj.userId !== 'string' || !obj.userId) {
    return { valid: false, error: 'userId é obrigatório' };
  }

  const jobType = obj.jobType;

  // Estes dois tipos não pertencem a nenhum Project (editor em massa e
  // listagem de canal), então não exigem projectId como os demais.
  if (jobType === 'RENDER_BULK_ITEM') {
    if (typeof obj.itemId !== 'string' || !obj.itemId) {
      return { valid: false, error: 'itemId é obrigatório para RENDER_BULK_ITEM' };
    }
    return { valid: true, data: payload as QueueJobPayload };
  }

  if (jobType === 'LIST_CHANNEL_VIDEOS') {
    if (typeof obj.requestId !== 'string' || !obj.requestId) {
      return { valid: false, error: 'requestId é obrigatório para LIST_CHANNEL_VIDEOS' };
    }
    return { valid: true, data: payload as QueueJobPayload };
  }

  if (typeof obj.projectId !== 'string' || !obj.projectId) {
    return { valid: false, error: 'projectId é obrigatório' };
  }

  if (jobType === 'RENDER_CLIP') {
    if (typeof obj.clipId !== 'string' || !obj.clipId) {
      return { valid: false, error: 'clipId é obrigatório para RENDER_CLIP' };
    }
    return { valid: true, data: payload as QueueJobPayload };
  }

  if (jobType === 'RETRANSCRIBE_CLIP') {
    if (typeof obj.clipId !== 'string' || !obj.clipId) {
      return { valid: false, error: 'clipId é obrigatório para RETRANSCRIBE_CLIP' };
    }
    return { valid: true, data: payload as QueueJobPayload };
  }

  if (jobType === 'PUBLISH_CLIP') {
    if (typeof obj.clipId !== 'string' || !obj.clipId) {
      return { valid: false, error: 'clipId é obrigatório para PUBLISH_CLIP' };
    }
    if (typeof obj.socialAccountId !== 'string' || !obj.socialAccountId) {
      return { valid: false, error: 'socialAccountId é obrigatório para PUBLISH_CLIP' };
    }
    return { valid: true, data: payload as QueueJobPayload };
  }

  if (!jobType || jobType === 'PROCESS_PROJECT') {
    return { valid: true, data: payload as QueueJobPayload };
  }

  return { valid: false, error: `jobType inválido: ${String(jobType)}` };
}
