import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';

// TikTok Content Posting API v2 (Direct Post).
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
const TIKTOK_BASE = 'https://open.tiktokapis.com/v2';

type InitResponse = {
  data?: { publish_id?: string; upload_url?: string };
  error?: { code?: string; message?: string };
};

type StatusResponse = {
  data?: { status?: string; publicaly_available_post_id?: string[]; fail_reason?: string };
  error?: { code?: string; message?: string };
};

@Injectable()
export class TikTokPublishService {
  private readonly logger = new Logger(TikTokPublishService.name);

  async publish(videoPath: string, title: string, accessToken: string, openId: string): Promise<{ id: string; url: string }> {
    this.logger.log({ msg: 'Publicando no TikTok (Content Posting API v2)', videoPath, title });

    if (!accessToken) throw new Error('TikTok sem access_token');
    if (!openId) throw new Error('open_id do usuário não fornecido');

    const video = await readFile(videoPath);
    const videoSize = video.byteLength;

    // 1. Init — uma única parte (chunk = arquivo inteiro). A v2 autentica pelo
    // Bearer token; não há mais access_token/open_id no corpo nem call separada
    // de "publish" — o post sai automaticamente após o upload completar.
    const initRes = await fetch(`${TIKTOK_BASE}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    });
    const initData = (await initRes.json().catch(() => ({}))) as InitResponse;
    if (!initRes.ok || initData.error?.code !== 'ok' || !initData.data?.upload_url || !initData.data?.publish_id) {
      throw new Error(`TikTok init falhou: ${initData.error?.message ?? (await initRes.text().catch(() => initRes.statusText))}`);
    }
    const { upload_url: uploadUrl, publish_id: publishId } = initData.data;

    // 2. Upload do vídeo (PUT com Content-Range; parte única cobre o arquivo todo).
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoSize),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: video,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text().catch(() => uploadRes.statusText);
      throw new Error(`TikTok upload falhou: ${err}`);
    }

    // 3. Status — o processamento é assíncrono. Faz polling curto para tentar
    // resolver o post_id final; se ainda estiver processando, devolve o
    // publish_id (o post já está garantido na fila do TikTok).
    const postId = await this.pollForPostId(accessToken, publishId);
    const id = postId ?? publishId;
    const url = postId ? `https://www.tiktok.com/@${openId}/video/${postId}` : `https://www.tiktok.com/@${openId}`;

    this.logger.log({ msg: 'Clip enviado ao TikTok', videoPath, publishId, postId: postId ?? null });
    return { id, url };
  }

  private async pollForPostId(accessToken: string, publishId: string, attempts = 6, delayMs = 2500): Promise<string | null> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        const res = await fetch(`${TIKTOK_BASE}/post/publish/status/fetch/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: publishId }),
        });
        const body = (await res.json().catch(() => ({}))) as StatusResponse;
        const status = body.data?.status;
        if (status === 'PUBLISH_COMPLETE') {
          return body.data?.publicaly_available_post_id?.[0] ?? null;
        }
        if (status === 'FAILED') {
          throw new Error(`TikTok processamento falhou: ${body.data?.fail_reason ?? 'desconhecido'}`);
        }
      } catch (error) {
        // Erro de polling não derruba a publicação — só impede resolver o post_id.
        this.logger.warn({ msg: 'Falha ao consultar status do TikTok', publishId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return null;
  }
}
