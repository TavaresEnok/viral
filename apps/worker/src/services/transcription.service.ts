import { Injectable } from '@nestjs/common';
import type { TranscriptPayload, TranscriptSegment } from '@viralforge/clip-analyzer';
import type { WordSegment } from '@viralforge/render-engine';
import OpenAI from 'openai';
import { Blob } from 'node:buffer';
import { createReadStream } from 'node:fs';
import { readdir, readFile, rm, stat, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { cleanText } from '@viralforge/shared';
import { FfmpegService } from './ffmpeg.service.js';

const MAX_WHISPER_BYTES = 25 * 1024 * 1024;
export type RemoteAsrMetrics = {
  provider: 'remote_accel';
  model?: string | null;
  computeType?: string | null;
  device?: string | null;
  batchSize?: number | null;
  downloadSec?: number | null;
  normalizeSec?: number | null;
  transcribeSec?: number | null;
  totalSec?: number | null;
  rtf?: number | null;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
};
type TranscriptWithWords = TranscriptPayload & { words?: WordSegment[]; remoteAsr?: RemoteAsrMetrics };
type RemoteTranscriptionResponse = {
  ok?: boolean;
  model?: string;
  compute_type?: string;
  device_requested?: string;
  device_used?: string;
  batch_size?: number;
  language?: string;
  duration?: number;
  timings?: Record<string, unknown>;
  cache_hit?: boolean;
  segments?: Array<{ start: number; end: number; text: string }>;
};

@Injectable()
export class TranscriptionService {
  constructor(private readonly ffmpeg: FfmpegService) {}

  async transcribeRemoteAudio(audioPath: string, language: string): Promise<TranscriptWithWords | null> {
    if (process.env.REMOTE_ACCEL_ENABLED !== 'true') return null;

    const baseUrl = process.env.REMOTE_ACCEL_BASE_URL ?? 'http://127.0.0.1:9873';
    const token = process.env.REMOTE_ACCEL_TOKEN;
    const timeoutMs = this.positiveInt(process.env.REMOTE_ACCEL_TIMEOUT_MS, 30 * 60 * 1000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const bytes = await readFile(audioPath);
      const form = new FormData();
      form.append('file', new Blob([bytes]) as unknown as globalThis.Blob, basename(audioPath));
      form.append('language', language.split('-')[0]);
      form.append('model', process.env.REMOTE_ACCEL_MODEL ?? 'turbo');
      form.append('device', process.env.REMOTE_ACCEL_DEVICE ?? 'cuda');
      form.append('compute_type', process.env.REMOTE_ACCEL_COMPUTE_TYPE ?? 'int8');
      form.append('batch_size', String(this.positiveInt(process.env.REMOTE_ACCEL_BATCH_SIZE, 1)));
      form.append('cleanup', 'true');

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/transcribe-file`, {
        method: 'POST',
        headers: token ? { 'X-Node-Key': token } : undefined,
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`remote ASR file failed ${response.status}: ${detail.slice(0, 500)}`);
      }

      const payload = (await response.json()) as RemoteTranscriptionResponse;
      return this.remotePayloadToTranscript(payload, language);
    } finally {
      clearTimeout(timeout);
    }
  }

  async transcribeRemoteUrl(sourceUrl: string, language: string): Promise<TranscriptWithWords | null> {
    if (process.env.REMOTE_ACCEL_ENABLED !== 'true') return null;

    const baseUrl = process.env.REMOTE_ACCEL_BASE_URL ?? 'http://127.0.0.1:9873';
    const token = process.env.REMOTE_ACCEL_TOKEN;
    const timeoutMs = this.positiveInt(process.env.REMOTE_ACCEL_TIMEOUT_MS, 30 * 60 * 1000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Node-Key': token } : {}),
        },
        body: JSON.stringify({
          url: sourceUrl,
          language: language.split('-')[0],
          model: process.env.REMOTE_ACCEL_MODEL ?? 'turbo',
          device: process.env.REMOTE_ACCEL_DEVICE ?? 'cuda',
          compute_type: process.env.REMOTE_ACCEL_COMPUTE_TYPE ?? 'int8',
          batch_size: this.positiveInt(process.env.REMOTE_ACCEL_BATCH_SIZE, 1),
          cleanup: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`remote ASR failed ${response.status}: ${detail.slice(0, 500)}`);
      }

      const payload = (await response.json()) as RemoteTranscriptionResponse;
      return this.remotePayloadToTranscript(payload, language);
    } finally {
      clearTimeout(timeout);
    }
  }

  async transcribe(audioPath: string, language: string, apiKey: string | null, model = 'whisper-1', baseURL?: string | null): Promise<TranscriptWithWords> {
    if (!apiKey) {
      if (process.env.ALLOW_SAMPLE_TRANSCRIPT === 'true') {
        return this.loadFallbackTranscript(language);
      }
      throw new Error('Transcrição por áudio exige uma API key de transcrição ativa. Configure OpenAI/OpenRouter antes de processar uploads ou vídeos sem legenda utilizável.');
    }

    const stats = await stat(audioPath);
    if (stats.size <= MAX_WHISPER_BYTES) {
      return this.transcribeSingle(audioPath, language, apiKey, model, baseURL);
    }

    const chunkDir = audioPath.replace(/\.mp3$/, '-chunks');
    const chunkPattern = resolve(chunkDir, 'chunk-%03d.mp3');
    await this.ffmpeg.splitAudio(audioPath, chunkPattern);
    let files: string[];
    try {
      files = (await readdir(chunkDir)).filter((file) => file.endsWith('.mp3')).sort();
    } catch {
      throw new Error('Falha ao ler chunks de áudio');
    }
    const transcripts: TranscriptWithWords[] = [];

    let accumulatedOffset = 0;
    try {
      for (let i = 0; i < files.length; i += 1) {
        const chunkPath = resolve(chunkDir, files[i]);
        const transcript = await this.transcribeSingle(chunkPath, language, apiKey, model, baseURL);
        // Offset baseado na duração REAL do chunk (ffprobe): a duração vinda do
        // provedor pode ser menor (silêncio no fim) e deslocaria as legendas de
        // todos os chunks seguintes.
        const chunkDuration =
          (await this.ffmpeg.probeDuration(chunkPath).catch(() => 0)) || transcript.duration || 600;
        transcripts.push({
          ...transcript,
          segments: transcript.segments.map((segment) => ({
            ...segment,
            start: segment.start + accumulatedOffset,
            end: segment.end + accumulatedOffset,
          })),
          words: transcript.words?.map((word) => ({
            ...word,
            start: word.start + accumulatedOffset,
            end: word.end + accumulatedOffset,
          })),
        });
        accumulatedOffset += chunkDuration;
      }
    } catch (error) {
      // Clean up on failure
      try {
        const leftoverFiles = await readdir(chunkDir).catch(() => []);
        for (const file of leftoverFiles) {
          await unlink(resolve(chunkDir, file)).catch(() => {});
        }
        await rm(chunkDir, { recursive: true, force: true }).catch(() => {});
      } catch {
        // best effort
      }
      throw error;
    }

    const segments = transcripts.flatMap((transcript) => transcript.segments);
    const words = transcripts.flatMap((transcript) => transcript.words ?? []);

    // Clean up chunk temp directory
    try {
      for (const file of files) {
        await unlink(resolve(chunkDir, file)).catch(() => {});
      }
      await rm(chunkDir, { recursive: true, force: true }).catch(() => {});
    } catch {
      // best effort cleanup
    }

    return {
      language,
      duration: segments.at(-1)?.end ?? 0,
      fullText: segments.map((segment) => segment.text).join(' '),
      segments,
      words: words.length ? words : this.approximateWords(segments),
    };
  }


  private async transcribeSingle(audioPath: string, language: string, apiKey: string, model: string, baseURL?: string | null): Promise<TranscriptWithWords> {
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    let response: Awaited<ReturnType<typeof client.audio.transcriptions.create>>;
    const stream = createReadStream(audioPath);
    try {
      response = await client.audio.transcriptions.create({
        file: stream as never,
        model,
        response_format: 'verbose_json',
        language: language.split('-')[0],
        timestamp_granularities: ['word', 'segment'],
      } as never);
    } catch (error) {
      stream.destroy();
      const message = error instanceof Error ? error.message : String(error);
      if (!/timestamp|granularit|word|segment|unsupported|param/i.test(message)) {
        throw error;
      }
      const retryStream = createReadStream(audioPath);
      try {
        response = await client.audio.transcriptions.create({
          file: retryStream as never,
          model,
          response_format: 'verbose_json',
          language: language.split('-')[0],
        } as never);
      } catch (retryError) {
        retryStream.destroy();
        throw retryError;
      }
    }

    const rawSegments = 'segments' in response && Array.isArray(response.segments) ? response.segments : [];
    const rawWords = 'words' in response && Array.isArray(response.words) ? response.words : [];
    const fullText = cleanText(String(response.text ?? rawSegments.map((segment) => segment.text).join(' ')));
    const segments: TranscriptSegment[] = rawSegments.map((segment, index) => ({
      id: index,
      start: Number(segment.start),
      end: Number(segment.end),
      text: cleanText(String(segment.text)),
    }));
    if (!segments.length && fullText) {
      const duration = await this.ffmpeg.probeDuration(audioPath).catch(() => 0);
      segments.push({
        id: 0,
        start: 0,
        end: duration,
        text: fullText,
      });
    }

    const words: WordSegment[] = rawWords.map((word, index) => ({
      word: cleanText(String(word.word ?? '')),
      start: Number(word.start),
      end: Number(word.end),
      confidence: typeof word.probability === 'number' ? word.probability : null,
      segmentIndex: index,
    })).filter((word) => word.word && Number.isFinite(word.start) && Number.isFinite(word.end));

    return {
      language,
      duration: segments.at(-1)?.end ?? 0,
      fullText,
      segments,
      words: words.length ? words : this.approximateWords(segments),
    };
  }

  private async loadFallbackTranscript(language: string): Promise<TranscriptWithWords> {
    const root = process.cwd().endsWith('/apps/worker') ? resolve(process.cwd(), '../..') : process.cwd();
    const fallbackPath = resolve(root, 'samples/transcript-podcast.json');
    const parsed = JSON.parse(await readFile(fallbackPath, 'utf8')) as TranscriptPayload;
    return {
      ...parsed,
      language,
      fullText: parsed.segments.map((segment) => segment.text).join(' '),
      words: this.approximateWords(parsed.segments),
    };
  }

  private remotePayloadToTranscript(payload: RemoteTranscriptionResponse, language: string): TranscriptWithWords {
    const segments: TranscriptSegment[] = (payload.segments ?? [])
      .map((segment, index) => ({
        id: index,
        start: Number(segment.start),
        end: Number(segment.end),
        text: cleanText(String(segment.text)),
      }))
      .filter((segment) => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end));

    if (!payload.ok || !segments.length) {
      throw new Error('remote ASR returned no transcript segments');
    }

    const timings = payload.timings ?? {};
    const duration = Number(payload.duration ?? segments.at(-1)?.end ?? 0);
    const totalSec = this.numberOrNull(timings.total_sec);
    const transcribeSec = this.numberOrNull(timings.transcribe_sec);
    const fallbackUsed = payload.device_used === 'cpu' || typeof timings.fallback_reason === 'string';

    return {
      language: payload.language ?? language,
      duration,
      fullText: segments.map((segment) => segment.text).join(' '),
      segments,
      words: this.approximateWords(segments),
      remoteAsr: {
        provider: 'remote_accel',
        model: payload.model ?? null,
        computeType: payload.compute_type ?? null,
        device: payload.device_used ?? payload.device_requested ?? null,
        batchSize: typeof payload.batch_size === 'number' ? payload.batch_size : null,
        downloadSec: this.numberOrNull(timings.download_audio_sec),
        normalizeSec: this.numberOrNull(timings.normalize_audio_sec),
        transcribeSec,
        totalSec,
        rtf: totalSec && duration > 0 ? totalSec / duration : null,
        cacheHit: Boolean(payload.cache_hit),
        fallbackUsed,
      },
    };
  }

  private approximateWords(segments: TranscriptSegment[]): WordSegment[] {
    return segments.flatMap((segment, segmentIndex) => {
      const words = cleanText(segment.text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      if (!words.length) return [];
      const duration = Math.max(0.1, segment.end - segment.start);
      const step = duration / words.length;
      return words.map((word, index) => ({
        word,
        start: segment.start + index * step,
        end: segment.start + (index + 1) * step,
        confidence: null,
        segmentIndex,
      }));
    });
  }

  private positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private numberOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
