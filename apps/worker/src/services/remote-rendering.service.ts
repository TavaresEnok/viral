import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RenderLayout } from '@prisma/client';
import { Blob } from 'node:buffer';
import { openAsBlob } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

export type RemoteRenderResult = {
  renderEngine: string;
  renderDurationMs?: number;
  faceTrackJson?: Prisma.InputJsonValue;
};

@Injectable()
export class RemoteRenderingService {
  private readonly logger = new Logger(RemoteRenderingService.name);

  isEnabled() {
    return process.env.REMOTE_RENDER_ENABLED === 'true';
  }

  async uploadMedia(inputPath: string): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const response = await this.request('/v1/media', async () => {
      const form = new FormData();
      const blob = await this.fileBlob(inputPath);
      form.append('file', blob, basename(inputPath));
      return { method: 'POST', body: form };
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`remote media upload failed ${response.status}: ${detail.slice(0, 500)}`);
    }

    const payload = (await response.json()) as { file_id?: string };
    if (!payload.file_id) throw new Error('remote media upload returned no file_id');
    return payload.file_id;
  }

  async deleteMedia(fileId: string | null | undefined): Promise<void> {
    if (!fileId || !this.isEnabled()) return;
    try {
      await this.request(`/v1/media/${encodeURIComponent(fileId)}`, () => ({ method: 'DELETE' }));
    } catch (error) {
      this.logger.warn({ msg: 'Remote media cleanup failed', fileId, error: error instanceof Error ? error.message : error });
    }
  }

  async renderClip(
    fileId: string,
    subtitlePath: string,
    outputPath: string,
    start: number,
    end: number,
    renderLayout: RenderLayout,
  ): Promise<RemoteRenderResult> {
    await mkdir(dirname(outputPath), { recursive: true });
    const response = await this.request('/v1/render-clip', async () => {
      const form = new FormData();
      form.append('file_id', fileId);
      form.append('subtitle', new Blob([await readFile(subtitlePath)]) as unknown as globalThis.Blob, basename(subtitlePath));
      form.append('start', String(start));
      form.append('end', String(end));
      form.append('render_layout', renderLayout);
      return { method: 'POST', body: form };
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`remote render failed ${response.status}: ${detail.slice(0, 500)}`);
    }

    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    const renderEngine = response.headers.get('x-node-render-engine') ?? 'remote-ffmpeg';
    const renderSec = Number(response.headers.get('x-node-render-sec'));
    const faceTrackingUsed = response.headers.get('x-node-face-tracking') === '1';
    const faceTrackingSec = Number(response.headers.get('x-node-face-tracking-sec'));
    const faceBackend = response.headers.get('x-node-face-backend') ?? 'unknown';
    return {
      renderEngine,
      renderDurationMs: Number.isFinite(renderSec) ? Math.round(renderSec * 1000) : undefined,
      faceTrackJson: {
        provider: `remote-${faceBackend}`,
        used: faceTrackingUsed,
        durationSec: Number.isFinite(faceTrackingSec) ? faceTrackingSec : 0,
      },
    };
  }

  async thumbnail(fileId: string, outputPath: string, start: number): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true });
    const response = await this.request('/v1/thumbnail', () => {
      const form = new FormData();
      form.append('file_id', fileId);
      form.append('start', String(start));
      return { method: 'POST', body: form };
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`remote thumbnail failed ${response.status}: ${detail.slice(0, 500)}`);
    }

    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  }

  private async request(path: string, initFactory: () => RequestInit | Promise<RequestInit>) {
    const baseUrl = process.env.REMOTE_ACCEL_BASE_URL ?? 'http://127.0.0.1:9873';
    const token = process.env.REMOTE_ACCEL_TOKEN;
    const timeoutMs = this.positiveInt(process.env.REMOTE_RENDER_TIMEOUT_MS, 60 * 60 * 1000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init = await initFactory();
      return await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: {
          ...(token ? { 'X-Node-Key': token } : {}),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fileBlob(path: string): Promise<globalThis.Blob> {
    if (typeof openAsBlob === 'function') {
      return (await openAsBlob(path)) as unknown as globalThis.Blob;
    }
    return new Blob([await readFile(path)]) as unknown as globalThis.Blob;
  }

  private positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
}
