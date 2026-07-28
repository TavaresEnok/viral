import { Injectable, Logger } from '@nestjs/common';
import type { TranscriptPayload, TranscriptSegment } from '@viralforge/clip-analyzer';
import { mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { youtubeDl } from 'youtube-dl-exec';
import { FfmpegService } from './ffmpeg.service.js';
import { assertPublicHttpUrl } from './url-safety.helper.js';

// Hosts liberados para download de UM vídeo por URL. Inclui as plataformas do
// importador de canal (channel-import.service.ts lista os vídeos; o download
// do vídeo individual selecionado reaproveita este método via sourceUrl no
// fluxo normal de PROCESS_PROJECT).
export const ALLOWED_DOWNLOAD_HOSTS = [
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com',
  'instagram.com', 'www.instagram.com',
  'kwai.com', 'www.kwai.com', 'm.kwai.com', 'kwai.com.br', 'www.kwai.com.br',
];

function positiveEnvInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

// Lidos em tempo de chamada (não no import) para o ConfigModule já ter
// carregado o .env. 15 min de teto: podcasts de 2-3h em conexão mediana
// estouravam os 5 min antigos.
function youtubeDownloadTimeoutMs(): number {
  return positiveEnvInt('YOUTUBE_DOWNLOAD_TIMEOUT_MS', 15 * 60 * 1000);
}

function youtubeTranscriptTimeoutMs(): number {
  return positiveEnvInt('YOUTUBE_TRANSCRIPT_TIMEOUT_MS', 60 * 1000);
}

@Injectable()
export class YoutubeDownloadService {
  private readonly logger = new Logger(YoutubeDownloadService.name);

  constructor(private readonly ffmpeg: FfmpegService) {}

  private async validateYoutubeUrl(url: string) {
    await assertPublicHttpUrl(url, ALLOWED_DOWNLOAD_HOSTS);
  }

  async download(url: string, baseDir: string): Promise<string> {
    await this.validateYoutubeUrl(url);
    await mkdir(baseDir, { recursive: true });
    await this.removePreviousDownloads(baseDir);
    const outputTemplate = resolve(baseDir, 'original.%(ext)s');

    // O YouTube estrangula download em conexão única. Duas alavancas pra
    // saturar a banda real da máquina:
    //   1. `concurrentFragments` — yt-dlp baixa N fragmentos DASH em paralelo.
    //   2. aria2c como downloader externo — abre N conexões por arquivo (split),
    //      o que destrava formatos servidos como stream contíguo (onde os
    //      fragmentos sozinhos não ajudam).
    // `concurrentFragments`/`externalDownloader*` existem no yt-dlp mas faltam
    // nos tipos do youtube-dl-exec, por isso o cast pontual.
    const aria2Connections = positiveEnvInt('YOUTUBE_ARIA2_CONNECTIONS', 16);
    const ytdlFlags = {
      output: outputTemplate,
      format: 'bv*[height<=720]+ba/b[height<=720]/best[height<=720]/best',
      mergeOutputFormat: 'mp4',
      noPlaylist: true,
      noWarnings: true,
      retries: 10,
      fragmentRetries: 10,
      concurrentFragments: positiveEnvInt('YOUTUBE_CONCURRENT_FRAGMENTS', 16),
      externalDownloader: 'aria2c',
      externalDownloaderArgs: `aria2c:-x${aria2Connections} -s${aria2Connections} -j${aria2Connections} -k1M --min-split-size=1M --optimize-concurrent-downloads=true`,
    };
    await youtubeDl(url, ytdlFlags as Parameters<typeof youtubeDl>[1], {
      timeout: youtubeDownloadTimeoutMs(),
    });

    const files = await readdir(baseDir);
    const candidates = files.filter((file) => file.startsWith('original.') && !file.endsWith('.part'));
    const preferred = ['original.mp4', 'original.mkv', 'original.webm', 'original.mov'];
    const ordered = [
      ...preferred.filter((file) => candidates.includes(file)),
      ...candidates.filter((file) => !preferred.includes(file)),
    ];
    const selected = await this.findFirstVideoFile(baseDir, ordered);

    if (!selected) {
      throw new Error('Download do YouTube não gerou arquivo com stream de vídeo');
    }

    const filePath = resolve(baseDir, selected);
    const fileStat = await stat(filePath);
    if (fileStat.size <= 0) {
      throw new Error(`Arquivo baixado está vazio: ${basename(filePath)}`);
    }

    return filePath;
  }

  private async removePreviousDownloads(baseDir: string) {
    const files = await readdir(baseDir).catch(() => []);
    await Promise.all(
      files
        .filter((file) => file.startsWith('original.'))
        .map((file) => unlink(resolve(baseDir, file)).catch(() => undefined)),
    );
  }

  private async findFirstVideoFile(baseDir: string, files: string[]) {
    for (const file of files) {
      const filePath = resolve(baseDir, file);
      if (await this.hasVideoStream(filePath)) {
        return file;
      }
    }
    return null;
  }

  private async hasVideoStream(filePath: string) {
    return this.ffmpeg.hasVideoStream(filePath);
  }

  async downloadTranscript(url: string, baseDir: string, language: string): Promise<TranscriptPayload | null> {
    await this.validateYoutubeUrl(url);
    await mkdir(baseDir, { recursive: true });
    const baseLanguage = language.split('-')[0];

    await youtubeDl(url, {
      skipDownload: true,
      writeAutoSub: true,
      writeSub: true,
      subLang: `${language},${baseLanguage},pt,en,es`,
      subFormat: 'vtt',
      output: resolve(baseDir, 'captions.%(ext)s'),
      noPlaylist: true,
      noWarnings: true,
    }, { timeout: youtubeTranscriptTimeoutMs() }).catch(() => null);

    const files = (await readdir(baseDir)).filter((file) => file.startsWith('captions.') && file.endsWith('.vtt'));
    if (!files.length) {
      return null;
    }

    const preferredFile =
      files.find((file) => file.includes(`.${language}.`)) ??
      files.find((file) => file.includes(`.${baseLanguage}.`)) ??
      files[0];
    const segments = this.parseVtt(await readFile(resolve(baseDir, preferredFile), 'utf8'));
    if (!segments.length) {
      return null;
    }

    return {
      language,
      duration: segments.at(-1)?.end ?? 0,
      fullText: segments.map((segment) => segment.text).join(' '),
      segments,
    };
  }

  private parseVtt(content: string): TranscriptSegment[] {
    const blocks = content.replace(/\r/g, '').split('\n\n');
    const segments: TranscriptSegment[] = [];

    for (const block of blocks) {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes('-->'));
      if (timingIndex === -1) {
        continue;
      }

      const [startRaw, endRaw] = lines[timingIndex].split('-->').map((value) => value.trim().split(/\s+/)[0]);
      const text = lines
        .slice(timingIndex + 1)
        .join(' ')
        .replace(/<[^>]+>/g, ' ');

      let cleanedText = this.cleanCaptionText(text);

      if (!cleanedText) {
        continue;
      }

      const previous = segments.at(-1);
      if (previous) {
        cleanedText = this.removeRollingCaptionOverlap(previous.text, cleanedText);
      }

      if (!cleanedText) {
        continue;
      }

      if (previous?.text === cleanedText) {
        previous.end = this.parseTimestamp(endRaw);
        continue;
      }

      segments.push({
        id: segments.length,
        start: this.parseTimestamp(startRaw),
        end: this.parseTimestamp(endRaw),
        text: cleanedText,
      });
    }

    return segments.filter((segment) => segment.end > segment.start);
  }

  private parseTimestamp(value: string): number {
    const parts = value.split(':');
    const seconds = Number(parts.pop()?.replace(',', '.') ?? 0);
    const minutes = Number(parts.pop() ?? 0);
    const hours = Number(parts.pop() ?? 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private cleanCaptionText(value: string): string {
    return this.decodeHtmlEntities(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/(?:^|\s)(?:pt|en|es)(?:-[a-z]{2})?\s*[:;>]+\s*/gi, ' ')
      .replace(/\b[a-z]{2}(?:-[a-z]{2})?\s*>\s*>/gi, ' ')
      .replace(/>{1,2}/g, ' ')
      .replace(/\[[^\]]+]/g, ' ')
      .replace(/\([^)]*(?:música|music|aplausos|risos|laughter)[^)]*\)/gi, ' ')
      .replace(/[^\p{Script=Latin}\p{Number}\s.,!?;:'"()-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private removeRollingCaptionOverlap(previousText: string, currentText: string): string {
    const previous = previousText.replace(/\s+/g, ' ').trim();
    const current = currentText.replace(/\s+/g, ' ').trim();
    if (!previous || !current) {
      return current;
    }

    if (current.toLowerCase().startsWith(previous.toLowerCase())) {
      return current
        .slice(previous.length)
        .replace(/^[\s,.;:!?'"()-]+/g, '')
        .trim();
    }

    const previousWords = previous.toLowerCase().split(/\s+/);
    const currentWords = current.split(/\s+/);
    const currentWordsLower = currentWords.map((word) => word.toLowerCase());
    const maxOverlap = Math.min(previousWords.length, currentWords.length, 30);

    for (let size = maxOverlap; size >= 2; size -= 1) {
      const previousTail = previousWords.slice(-size).join(' ');
      const currentHead = currentWordsLower.slice(0, size).join(' ');
      if (previousTail === currentHead) {
        return currentWords.slice(size).join(' ').trim();
      }
    }

    return current;
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&amp;/gi, '&')
      .replace(/&lt;?/gi, '<')
      .replace(/&gt(?::;|;)?/gi, '>')
      .replace(/&quot;?/gi, '"')
      .replace(/&#(?:0*39|x0*27);?/gi, "'")
      .replace(/&apos;?/gi, "'");
  }
}
