import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const IG_BASE = 'https://graph.facebook.com/v22.0';

function buildPublicVideoUrl(videoPath: string): string {
  const mediaBaseUrl = process.env.INSTAGRAM_MEDIA_BASE_URL;
  if (mediaBaseUrl) {
    const fileName = videoPath.split('/').pop() ?? 'video.mp4';
    return `${mediaBaseUrl.replace(/\/$/, '')}/${fileName}`;
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const fileName = videoPath.split('/').pop() ?? 'video.mp4';
  return `${apiBaseUrl.replace(/\/$/, '')}/clips/public/${fileName}`;
}

@Injectable()
export class InstagramPublishService {
  private readonly logger = new Logger(InstagramPublishService.name);

  async publishReel(videoPath: string, caption: string, accessToken: string, instagramAccountId: string): Promise<{ id: string; url: string }> {
    this.logger.log({ msg: 'Publicando no Instagram Reels', instagramAccountId });

    const videoUrl = buildPublicVideoUrl(videoPath);

    // 1. Copy video to public directory for serving
    try {
      const publicDir = process.env.INSTAGRAM_PUBLIC_DIR ?? resolve(process.cwd(), 'public/clips');
      await mkdir(publicDir, { recursive: true });
      const fileName = videoPath.split('/').pop() ?? 'video.mp4';
      const destPath = resolve(publicDir, fileName);
      const videoBuffer = await readFile(videoPath);
      await writeFile(destPath, videoBuffer);
      this.logger.log({ msg: 'Vídeo copiado para diretório público', destPath, videoUrl });
    } catch (copyError) {
      this.logger.warn({
        msg: 'Não foi possível copiar vídeo para diretório público. A URL precisa estar acessível externamente.',
        error: copyError instanceof Error ? copyError.message : String(copyError),
        videoUrl,
      });
    }

    // 2. Create media container
    const mediaRes = await fetch(`${IG_BASE}/${instagramAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption.slice(0, 2200),
        access_token: accessToken,
      }),
    });
    if (!mediaRes.ok) {
      const err = await mediaRes.text();
      throw new Error(`Instagram media create falhou: ${err}`);
    }
    const mediaData = await mediaRes.json() as { id: string };

    // 3. Publish the media container
    const publishRes = await fetch(`${IG_BASE}/${instagramAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: mediaData.id,
        access_token: accessToken,
      }),
    });
    if (!publishRes.ok) {
      const err = await publishRes.text();
      throw new Error(`Instagram publish falhou: ${err}`);
    }
    const publishData = await publishRes.json() as { id: string };

    this.logger.log({ msg: 'Reel publicado no Instagram', mediaId: publishData.id });
    return { id: publishData.id, url: `https://instagram.com/reel/${publishData.id}` };
  }
}
