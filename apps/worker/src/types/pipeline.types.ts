import type { LlmTelemetry, TranscriptPayload } from "@viralforge/clip-analyzer";
import type { WordSegment } from "@viralforge/render-engine";
import type { RemoteAsrMetrics } from "../services/transcription.service.js";

export type TranscriptQuality = {
    ok: boolean;
    score: number;
    reason: string;
    warnings: string[];
};

export type TranscriptWithMetadata = TranscriptPayload & {
    words?: WordSegment[];
    source?: string;
    sourceModel?: string;
    quality?: TranscriptQuality;
    remoteAsr?: RemoteAsrMetrics;
};

export type PipelineMetricDraft = {
    projectId: string;
    jobId: string;
    status: "COMPLETED" | "FAILED";
    failedStage?: string | null;
    errorMessage?: string | null;
    totalSec: number;
    stageTimings: Record<string, number>;
    videoDurationSec?: number | null;
    transcript?: TranscriptWithMetadata | null;
    llmTelemetry?: LlmTelemetry | null;
    llmCostEstimate?: number | null;
    rawClipCount?: number | null;
    validatedClipCount?: number | null;
    renderedClipCount?: number | null;
    failedRenderCount?: number | null;
    renderEngines?: Record<string, number>;
    remoteGpuUsed?: boolean | null;
    fallbackUsed?: boolean | null;
};

export type RenderClipsSummary = {
    completed: number;
    failed: number;
    engines: Record<string, number>;
    remoteGpuUsed: boolean;
    fallbackUsed: boolean;
};

export const PG_INT4_MIN = -2147483648;
export const PG_INT4_MAX = 2147483647;

/**
 * Coerce an arbitrary value (often produced by an LLM) into a finite 32-bit
 * integer. NaN/Infinity/out-of-range/undefined collapse to `fallback`.
 * Prevents Postgres "22P03 incorrect binary data format" when binding a bad
 * number into an Int column.
 */
export function safeInt(value: unknown, fallback = 0): number {
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return fallback;
    return Math.max(PG_INT4_MIN, Math.min(PG_INT4_MAX, rounded));
}

export function safeIntOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return null;
    return Math.max(PG_INT4_MIN, Math.min(PG_INT4_MAX, rounded));
}

export function safeFloat(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeFloatOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function safeString(value: unknown, fallback = ""): string {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

export function safeStringOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return safeString(value);
}

export function positiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * ALLOW_AI_FALLBACK=false faz o pipeline FALHAR com mensagem acionável quando
 * a IA não produz cortes válidos, em vez de gerar cortes sintéticos
 * silenciosamente. Padrão: permitido (comportamento histórico) — recomendado
 * desligar em produção depois que o modelo do /admin/ai estiver validado.
 */
export function aiFallbackAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env.ALLOW_AI_FALLBACK ?? "true").trim().toLowerCase() !== "false";
}

export const CLIP_TARGET_FLOOR = 5;
export const CLIP_TARGET_CEIL = 20;
/** ~1 corte a cada 3,5 min. */
export const CLIP_SECONDS_PER_CLIP = 210;

/**
 * Alvo dinâmico de cortes por vídeo. Concorrentes (Opus Clip, Vizard) escalam
 * o número de cortes com a duração — o ClipAI era travado em 5 pra qualquer
 * vídeo. Mantém piso de {@link CLIP_TARGET_FLOOR} (sem regressão em vídeos
 * curtos) e escala até {@link CLIP_TARGET_CEIL}. Quando informado, limita pelo
 * saldo de renders do usuário pra não gerar mais do que a cota permite (evita
 * gerar 20 e falhar no gate de quota depois).
 */
export function computeClipTarget(durationSeconds: number, remainingRenders?: number): number {
    const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
    const byDuration = Math.max(
        CLIP_TARGET_FLOOR,
        Math.min(CLIP_TARGET_CEIL, Math.round(safeDuration / CLIP_SECONDS_PER_CLIP)),
    );
    if (typeof remainingRenders === "number" && remainingRenders > 0) {
        return Math.max(1, Math.min(byDuration, remainingRenders));
    }
    return byDuration;
}
