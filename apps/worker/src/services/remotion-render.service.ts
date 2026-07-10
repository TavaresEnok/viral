import { Injectable } from '@nestjs/common';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { CaptionTheme, RenderLayout } from '@prisma/client';
import type { TranscriptSegment } from '@viralforge/clip-analyzer';
import type { WordSegment, VerticalClipProps, OverlayItem, SmartCrop } from '@viralforge/render-engine';
import { createServer, type ServerResponse } from 'node:http';
import { cpus } from 'node:os';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { OverlayBuilderService } from './overlay-builder.service.js';

function repoRoot() {
  return process.cwd().endsWith('/apps/worker') ? resolve(process.cwd(), '../..') : process.cwd();
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

@Injectable()
export class RemotionRenderService {
  private bundleUrlPromise: Promise<string> | null = null;
  private readonly concurrency = positiveInt(process.env.REMOTION_CONCURRENCY, Math.max(2, Math.floor(cpus().length * 0.8)));

  constructor(private readonly overlayBuilder: OverlayBuilderService) {}

  async renderClip(
    inputPath: string,
    outputPath: string,
    clip: { start: number; end: number },
    segments: TranscriptSegment[],
    words: WordSegment[] | undefined,
    options: { captionTheme: CaptionTheme; renderLayout: RenderLayout; smartCrop?: SmartCrop | null; autoOverlays?: boolean },
  ) {
    await mkdir(dirname(outputPath), { recursive: true });
    const localAsset = await this.serveLocalFile(inputPath);

    try {
      const fps = 30;
      const clipWords = words ?? [];
      const enableOverlays = options.autoOverlays ?? (process.env.ENABLE_AUTO_EMOJI === 'true' || process.env.ENABLE_AUTO_SFX === 'true');
      const autoOverlays: OverlayItem[] = enableOverlays
        ? this.overlayBuilder.buildAll(clipWords, Math.max(1, clip.end - clip.start))
        : [];
      const inputProps: VerticalClipProps = {
        videoSrc: localAsset.url,
        startAtSeconds: clip.start,
        durationSeconds: Math.max(1, clip.end - clip.start),
        segments: segments.map((segment) => ({ start: segment.start, end: segment.end, text: segment.text })),
        words: clipWords,
        overlays: autoOverlays,
        theme: options.captionTheme as VerticalClipProps['theme'],
        layout: options.renderLayout as VerticalClipProps['layout'],
        fps,
        smartCrop: options.smartCrop ?? null,
      };

      const serveUrl = await this.getBundleUrl();
      const composition = await selectComposition({
        serveUrl,
        id: 'VerticalClip',
        inputProps: inputProps as unknown as Record<string, unknown>,
      });

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: inputProps as unknown as Record<string, unknown>,
        chromiumOptions: {
          enableMultiProcessOnLinux: true,
        },
        concurrency: this.concurrency,
      });
    } finally {
      await localAsset.close();
    }
  }

  private async getBundleUrl() {
    try {
      if (!this.bundleUrlPromise) {
        this.bundleUrlPromise = bundle({
          entryPoint: resolve(repoRoot(), 'packages/render-engine/src/entry.tsx'),
          onProgress: () => undefined,
          webpackOverride: (config) => ({
            ...config,
            resolve: {
              ...config.resolve,
              extensionAlias: {
                '.js': ['.ts', '.tsx', '.js'],
                '.jsx': ['.tsx', '.jsx'],
              },
            },
          }),
        });
      }
      return await this.bundleUrlPromise;
    } catch (error) {
      this.bundleUrlPromise = null;
      throw error;
    }
  }

  private async serveLocalFile(filePath: string): Promise<{ url: string; close: () => Promise<void> }> {
    const fileStats = await stat(filePath);
    const mimeType = this.mimeType(filePath);

    const server = createServer((request, response) => {
      if (!request.url?.startsWith('/input')) {
        response.writeHead(404).end();
        return;
      }

      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Type', mimeType);

      const range = request.headers.range;
      if (range) {
        this.writeRange(response, filePath, fileStats.size, range);
        return;
      }

      response.writeHead(200, { 'Content-Length': fileStats.size });
      const stream = createReadStream(filePath);
      stream.on('error', () => { response.destroy(); });
      stream.pipe(response);
    });

    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    const address = server.address();
    if (!address || typeof address === 'string') {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      throw new Error('Não foi possível iniciar servidor local de assets para Remotion');
    }

    return {
      url: `http://127.0.0.1:${address.port}/input${extname(filePath) || '.mp4'}`,
      close: () => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
    };
  }

  private writeRange(response: ServerResponse, filePath: string, size: number, range: string) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (start >= size || end >= size || start > end) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }

    response.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    });
    const stream = createReadStream(filePath, { start, end });
    stream.on('error', () => { response.destroy(); });
    stream.pipe(response);
  }

  private mimeType(filePath: string) {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.mov') return 'video/quicktime';
    if (ext === '.mkv') return 'video/x-matroska';
    if (ext === '.webm') return 'video/webm';
    return 'video/mp4';
  }
}
