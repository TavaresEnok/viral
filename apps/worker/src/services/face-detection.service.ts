import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { Blob } from 'node:buffer';

const execFileAsync = promisify(execFile);

interface FaceTrackPoint {
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

interface RemoteTrackFacesResponse {
  ok?: boolean;
  points?: FaceTrackPoint[];
  backend?: string;
  device?: string;
  sec?: number;
}

@Injectable()
export class FaceDetectionService {
  private readonly logger = new Logger(FaceDetectionService.name);

  async trackFaces(inputPath: string, start: number, duration: number, fps: number = 2): Promise<FaceTrackPoint[]> {
    const remote = await this.trackFacesRemote(inputPath, start, duration, fps).catch((error: unknown) => {
      this.logger.warn({
        msg: 'Face tracking remoto (GPU) falhou; caindo para o binário local (CPU)',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    if (remote) return remote;
    return this.trackFacesLocal(inputPath, start, duration, fps);
  }

  /**
   * Face tracking na GPU via node_agent (insightface/CUDA) — mesmo contrato de
   * saída do binário C++ local, então quem usa o resultado (SmartCropService:
   * EMA, cache em disco, cluster de 2 rostos) não muda nada.
   *
   * Extrai só o intervalo do corte antes de enviar (não o vídeo inteiro): o
   * upload fica pequeno e rápido independente do tamanho do vídeo de origem.
   * `null` (não erro) quando o acelerador remoto está desligado — o chamador
   * decide silenciosamente ir para CPU, sem logar como falha.
   */
  private async trackFacesRemote(
    inputPath: string,
    start: number,
    duration: number,
    fps: number,
  ): Promise<FaceTrackPoint[] | null> {
    if (process.env.REMOTE_ACCEL_ENABLED !== 'true') return null;

    const baseUrl = process.env.REMOTE_ACCEL_BASE_URL ?? 'http://127.0.0.1:9873';
    const token = process.env.REMOTE_ACCEL_TOKEN;
    const timeoutMs = this.positiveInt(process.env.REMOTE_ACCEL_FACE_TIMEOUT_MS, 2 * 60 * 1000);

    const segmentPath = join(tmpdir(), `face-track-${randomUUID()}.mp4`);
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-loglevel', 'error',
        '-ss', String(Math.max(0, start)),
        '-t', String(Math.max(1, duration)),
        '-i', inputPath,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        segmentPath,
      ]);

      const bytes = await readFile(segmentPath);
      const form = new FormData();
      form.append('file', new Blob([bytes]) as unknown as globalThis.Blob, 'segment.mp4');
      form.append('fps', String(fps));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/track-faces`, {
          method: 'POST',
          headers: token ? { 'X-Node-Key': token } : undefined,
          body: form,
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`remote face tracking failed ${response.status}: ${detail.slice(0, 500)}`);
        }
        const payload = (await response.json()) as RemoteTrackFacesResponse;
        const points = payload.points ?? [];
        this.logger.debug({
          msg: 'Face tracking remoto (GPU) concluído',
          points: points.length,
          backend: payload.backend,
          device: payload.device,
          sec: payload.sec,
        });
        // Tempo do recorte é relativo a t=0 (o worker extraiu antes de
        // enviar); soma o offset absoluto do vídeo original aqui, do mesmo
        // jeito que retranscribeClip já faz para a legenda de um corte.
        return points.map((p) => ({ ...p, time: p.time + start }));
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      await unlink(segmentPath).catch(() => undefined);
    }
  }

  /** Binário C++ nativo (OpenCV DNN, CPU) — rede de segurança do caminho remoto. */
  private async trackFacesLocal(
    inputPath: string,
    start: number,
    duration: number,
    fps: number,
  ): Promise<FaceTrackPoint[]> {
    this.logger.debug(`Starting native C++ face tracking: ${inputPath} (start: ${start}, duration: ${duration})`);

    const rootDir = process.cwd().endsWith('/apps/worker') ? resolve(process.cwd(), '../..') : process.cwd();
    const enginePath = join(rootDir, 'packages/face-engine/build/face_engine');
    const prototxt = join(rootDir, 'packages/face-engine/models/deploy.prototxt');
    const caffemodel = join(rootDir, 'packages/face-engine/models/res10_300x300_ssd_iter_140000.caffemodel');

    try {
      const { stdout } = await execFileAsync(enginePath, [
        inputPath,
        String(start),
        String(duration),
        String(fps),
        prototxt,
        caffemodel,
      ], { maxBuffer: 50 * 1024 * 1024 }); // 50MB max buffer

      const result = JSON.parse(stdout.trim() || '[]');
      this.logger.debug(`Face tracking completed: found faces in ${result.length} frames`);
      return result;
    } catch (error) {
      this.logger.error('Native face tracking failed', error);
      return [];
    }
  }

  private positiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
}
