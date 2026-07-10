import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from './prisma.service.js';
import { decryptSecret, getMasterSecret, getYouTubeClientId, getYouTubeClientSecret } from '@viralforge/shared';
import { createReadStream } from 'node:fs';

@Injectable()
export class YoutubePublishService {
  private readonly logger = new Logger(YoutubePublishService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getOAuth2Client() {
    const clientId = getYouTubeClientId();
    const clientSecret = getYouTubeClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET são obrigatórios');
    }
    return new google.auth.OAuth2({ clientId, clientSecret });
  }

  async publishClip(
    clipId: string,
    socialAccountId: string,
    videoPath: string,
  ): Promise<{ videoId: string; url: string }> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
    });
    if (!account || !account.refreshTokenEncrypted) {
      throw new Error('Conta social não configurada para YouTube');
    }

    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new Error('Clip não encontrado');

    const masterSecret = getMasterSecret();
    if (!masterSecret) throw new Error('MASTER_SECRET não configurada');
    const refreshToken = decryptSecret(account.refreshTokenEncrypted, masterSecret);
    const auth = this.getOAuth2Client();
    auth.setCredentials({ refresh_token: refreshToken });

    const youtube = google.youtube({ version: 'v3', auth });

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          // #Shorts no título/descrição garante que o YouTube classifique o
          // vídeo 9:16 como Short (caso contrário pode virar vídeo normal).
          title: `${clip.suggestedCaptionTitle || clip.title} #Shorts`,
          description: `${clip.hook || clip.title}\n\nGerado com ViralForge.\n\n#Shorts`,
          tags: ['viralforge', 'shorts'],
          categoryId: '22',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: createReadStream(videoPath) as unknown as NodeJS.ReadableStream,
        mimeType: 'video/mp4',
      },
    });

    const videoId = response.data.id;
    if (!videoId) throw new Error('YouTube não retornou ID do vídeo');

    this.logger.log({ msg: 'Clip publicado no YouTube', clipId, videoId });

    return {
      videoId,
      url: `https://youtube.com/watch?v=${videoId}`,
    };
  }
}
