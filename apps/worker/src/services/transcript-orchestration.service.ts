import { Injectable, Logger } from "@nestjs/common";
import type { TranscriptPayload } from "@viralforge/clip-analyzer";
import type { WordSegment } from "@viralforge/render-engine";
import { CircuitBreaker } from "../utils/circuit-breaker.js";
import type { TranscriptQuality, TranscriptWithMetadata } from "../types/pipeline.types.js";
import { PrismaService } from "./prisma.service.js";
import { TranscriptionService, type RemoteAsrMetrics } from "./transcription.service.js";
import { YoutubeDownloadService } from "./youtube-download.service.js";

@Injectable()
export class TranscriptOrchestrationService {
    private readonly logger = new Logger(TranscriptOrchestrationService.name);
    private readonly remoteAsrCircuit = new CircuitBreaker("remote-asr", {
        failureThreshold: 3,
        recoveryMs: 120_000,
    });

    constructor(
        private readonly prisma: PrismaService,
        private readonly transcription: TranscriptionService,
        private readonly youtubeDownload: YoutubeDownloadService,
    ) {}

    async buildTranscript(args: {
        sourceUrl?: string;
        baseDir: string;
        audioPath: string;
        language: string;
        openaiApiKey: string | null;
        openaiTranscriptionModel: string;
        openaiTranscriptionBaseUrl?: string | null;
        skipYoutubeTranscript?: boolean;
    }): Promise<TranscriptWithMetadata> {
        if (args.sourceUrl && !args.skipYoutubeTranscript) {
            const youtubeTranscript = await this.tryBuildYoutubeTranscript(
                args.sourceUrl,
                args.baseDir,
                args.language,
                args.openaiApiKey,
            );
            if (youtubeTranscript) return youtubeTranscript;
        }

        if (process.env.YOUTUBE_CAPTIONS_ONLY === "true") {
            throw new Error(
                "Modo rápido por legenda está ativo, mas o YouTube não entregou legenda utilizável para este vídeo.",
            );
        }

        if (process.env.REMOTE_ACCEL_ENABLED === "true") {
            try {
                const remoteTranscript = await this.remoteAsrCircuit.call(() =>
                    this.transcription.transcribeRemoteAudio(args.audioPath, args.language),
                );
                if (remoteTranscript) {
                    const quality = this.assessTranscriptQuality(remoteTranscript);
                    return {
                        ...remoteTranscript,
                        source: "remote_accel_asr_file",
                        sourceModel: [
                            remoteTranscript.remoteAsr?.model ?? process.env.REMOTE_ACCEL_MODEL ?? "turbo",
                            remoteTranscript.remoteAsr?.computeType ?? process.env.REMOTE_ACCEL_COMPUTE_TYPE ?? "int8",
                        ].join(":"),
                        quality,
                    };
                }
            } catch (error) {
                this.logger.warn({
                    msg: "ASR remoto por upload de áudio falhou; usando fallback local/API.",
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        }

        if (
            args.sourceUrl &&
            process.env.REMOTE_ACCEL_ENABLED === "true" &&
            process.env.REMOTE_ACCEL_ALLOW_URL_FALLBACK === "true"
        ) {
            try {
                const remoteTranscript = await this.remoteAsrCircuit.call(() =>
                    this.transcription.transcribeRemoteUrl(args.sourceUrl!, args.language),
                );
                if (remoteTranscript) {
                    const quality = this.assessTranscriptQuality(remoteTranscript);
                    return {
                        ...remoteTranscript,
                        source: "remote_accel_asr_url",
                        sourceModel: [
                            remoteTranscript.remoteAsr?.model ?? process.env.REMOTE_ACCEL_MODEL ?? "turbo",
                            remoteTranscript.remoteAsr?.computeType ?? process.env.REMOTE_ACCEL_COMPUTE_TYPE ?? "int8",
                        ].join(":"),
                        quality,
                    };
                }
            } catch (error) {
                this.logger.warn({
                    msg: "ASR remoto por URL falhou; usando fallback local/API.",
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        }

        const transcript = await this.transcription.transcribe(
            args.audioPath,
            args.language,
            args.openaiApiKey,
            args.openaiTranscriptionModel,
            args.openaiTranscriptionBaseUrl,
        );
        const quality = this.assessTranscriptQuality(transcript);
        return {
            ...transcript,
            source: "audio_asr",
            sourceModel: args.openaiTranscriptionModel,
            quality,
        };
    }

    async tryBuildYoutubeTranscript(
        sourceUrl: string,
        baseDir: string,
        language: string,
        openaiApiKey?: string | null,
    ): Promise<TranscriptWithMetadata | null> {
        const youtubeTranscript = await this.youtubeDownload.downloadTranscript(
            sourceUrl,
            baseDir,
            language,
        );
        if (!youtubeTranscript) return null;

        const quality = this.assessTranscriptQuality(youtubeTranscript);
        if (quality.ok || process.env.YOUTUBE_CAPTIONS_ONLY === "true") {
            if (!quality.ok) {
                this.logger.warn({
                    msg: `Modo rápido ativo: usando legenda do YouTube mesmo com alerta de qualidade (${quality.reason}).`,
                    qualityScore: quality.score,
                    qualityWarnings: quality.warnings,
                });
            }
            return {
                ...youtubeTranscript,
                source: quality.ok ? "youtube_captions" : "youtube_captions_fast_degraded",
                sourceModel: "youtube",
                quality,
            };
        }

        if (!openaiApiKey) {
            this.logger.warn({
                msg: `Transcrição do YouTube parece degradada (${quality.reason}), mas não há API key de transcrição. Continuando com revisão obrigatória.`,
                qualityScore: quality.score,
                qualityWarnings: quality.warnings,
            });
            return {
                ...youtubeTranscript,
                source: "youtube_captions_degraded",
                sourceModel: "youtube",
                quality,
            };
        }

        this.logger.warn({
            msg: `Transcrição do YouTube parece degradada (${quality.reason}). Refazendo transcrição pelo áudio.`,
            qualityScore: quality.score,
            qualityWarnings: quality.warnings,
        });
        return null;
    }

    assessTranscriptQuality(transcript: TranscriptPayload): TranscriptQuality {
        const text = (
            transcript.fullText ??
            transcript.segments.map((segment) => segment.text).join(" ")
        )
            .replace(/\s+/g, " ")
            .trim();
        const words = text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean);
        const warnings: string[] = [];
        let score = 100;

        if (transcript.segments.length < 8 || words.length < 80) {
            warnings.push("texto curto demais");
            score -= 45;
        }

        const unusualChars =
            text.match(/[^\p{Script=Latin}\p{Number}\s.,!?;:'"()-]/gu)?.length ?? 0;
        const unusualRatio = text.length ? unusualChars / text.length : 1;
        if (unusualRatio > 0.03) {
            warnings.push(`caracteres inesperados ${(unusualRatio * 100).toFixed(1)}%`);
            score -= Math.min(35, Math.round(unusualRatio * 500));
        }

        let adjacentRepeats = 0;
        for (let i = 1; i < words.length; i += 1) {
            if (words[i] === words[i - 1]) adjacentRepeats += 1;
        }
        const adjacentRepeatRatio = adjacentRepeats / words.length;
        if (adjacentRepeatRatio > 0.12) {
            warnings.push(`repetição adjacente ${(adjacentRepeatRatio * 100).toFixed(1)}%`);
            score -= Math.min(35, Math.round(adjacentRepeatRatio * 180));
        }

        const phraseCounts = new Map<string, number>();
        for (let i = 0; i + 2 < words.length; i += 1) {
            const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
            phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
        }
        const maxPhraseCount = Math.max(0, ...phraseCounts.values());
        const phraseCoverage = words.length ? (maxPhraseCount * 3) / words.length : 1;
        if (words.length > 500 && phraseCoverage > 0.08) {
            warnings.push(`frase repetida cobre ${(phraseCoverage * 100).toFixed(1)}%`);
            score -= Math.min(35, Math.round(phraseCoverage * 160));
        }

        const finalScore = Math.max(0, Math.min(100, score));
        return {
            ok: finalScore >= 70 && warnings.length === 0,
            score: finalScore,
            reason: warnings[0] ?? "ok",
            warnings,
        };
    }

    ensureTranscriptWords(transcript: TranscriptWithMetadata): TranscriptWithMetadata {
        if (transcript.words?.length) return transcript;

        const words = transcript.segments.flatMap((segment, segmentIndex) => {
            const parts = segment.text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
            if (!parts.length) return [];
            const duration = Math.max(0.1, segment.end - segment.start);
            const step = duration / parts.length;
            return parts.map((word, index) => ({
                word,
                start: segment.start + index * step,
                end: segment.start + (index + 1) * step,
                confidence: null,
                segmentIndex,
            }));
        });

        return { ...transcript, words };
    }

    async loadCachedTranscript(projectId: string): Promise<TranscriptWithMetadata | null> {
        const record = await this.prisma.transcript.findUnique({ where: { projectId } });
        if (!record?.segmentsJson) return null;
        const segments = JSON.parse(
            JSON.stringify(record.segmentsJson),
        ) as TranscriptPayload["segments"];
        if (!Array.isArray(segments) || segments.length === 0) return null;
        const words = record.wordsJson
            ? (JSON.parse(JSON.stringify(record.wordsJson)) as WordSegment[])
            : undefined;
        return {
            segments,
            words,
            language: record.language ?? undefined,
            fullText: record.fullText ?? undefined,
            source: record.source ?? undefined,
            sourceModel: record.sourceModel ?? undefined,
            quality:
                record.qualityScore != null
                    ? {
                          ok: true,
                          score: record.qualityScore,
                          reason: "transcrição reaproveitada",
                          warnings: Array.isArray(record.qualityWarnings)
                              ? (record.qualityWarnings as string[])
                              : [],
                      }
                    : undefined,
        };
    }

    async saveTranscript(projectId: string, transcript: TranscriptWithMetadata): Promise<void> {
        const fullText =
            transcript.fullText ??
            transcript.segments.map((segment) => segment.text).join(" ");
        await this.prisma.transcript.upsert({
            where: { projectId },
            update: {
                language: transcript.language ?? "pt-BR",
                source: transcript.source ?? "unknown",
                sourceModel: transcript.sourceModel ?? null,
                qualityScore: transcript.quality?.score ?? null,
                qualityWarnings: transcript.quality?.warnings
                    ? (transcript.quality.warnings as never)
                    : undefined,
                segmentCount: transcript.segments.length,
                wordCount:
                    transcript.words?.length ??
                    fullText.split(/\s+/).filter(Boolean).length,
                fullText,
                segmentsJson: transcript.segments as never,
                wordsJson: transcript.words as never,
            },
            create: {
                projectId,
                language: transcript.language ?? "pt-BR",
                source: transcript.source ?? "unknown",
                sourceModel: transcript.sourceModel ?? null,
                qualityScore: transcript.quality?.score ?? null,
                qualityWarnings: transcript.quality?.warnings
                    ? (transcript.quality.warnings as never)
                    : undefined,
                segmentCount: transcript.segments.length,
                wordCount:
                    transcript.words?.length ??
                    fullText.split(/\s+/).filter(Boolean).length,
                fullText,
                segmentsJson: transcript.segments as never,
                wordsJson: transcript.words as never,
            },
        });

        await this.saveAsrMetrics(projectId, transcript.remoteAsr);
    }

    async saveAsrMetrics(projectId: string, metrics?: RemoteAsrMetrics): Promise<void> {
        await this.prisma.$executeRaw`
      UPDATE "Transcript"
      SET
        "asrProvider" = ${metrics?.provider ?? null},
        "asrModel" = ${metrics?.model ?? null},
        "asrComputeType" = ${metrics?.computeType ?? null},
        "asrDevice" = ${metrics?.device ?? null},
        "asrBatchSize" = ${metrics?.batchSize ?? null},
        "asrDownloadSec" = ${metrics?.downloadSec ?? null},
        "asrNormalizeSec" = ${metrics?.normalizeSec ?? null},
        "asrTranscribeSec" = ${metrics?.transcribeSec ?? null},
        "asrTotalSec" = ${metrics?.totalSec ?? null},
        "asrRtf" = ${metrics?.rtf ?? null},
        "asrCacheHit" = ${metrics?.cacheHit ?? false},
        "asrFallbackUsed" = ${metrics?.fallbackUsed ?? false}
      WHERE "projectId" = ${projectId}
    `;
    }
}
