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

/** Alinhado ao teto de 30 cortes do LlmClipAnalyzerService e do schema de resposta da IA. */
export const CLIP_TARGET_CEIL = 30;

/**
 * Quantos cortes pedir à IA / aceitar após validação.
 *
 * Não escala mais pra baixo pela duração do vídeo — um vídeo de 10 min com
 * conteúdo denso pode ter tantos cortes bons quanto um de 2h, e travar o
 * teto em função da duração descartava cortes que já bateram o piso de
 * score (75) só porque o vídeo era curto. Quem decide a quantidade final de
 * verdade é o filtro de score em video-processor.service.ts e a validação
 * estrutural em clip-validation.service.ts (duração 15-90s, dedup por
 * sobreposição/similaridade) — não um teto artificial por minutagem.
 *
 * Os dois únicos limites reais que sobram: o teto absoluto de
 * {@link CLIP_TARGET_CEIL} (o próprio schema da resposta da IA já capa em
 * 30) e o saldo de renders do usuário, pra não gerar mais cortes do que a
 * cota permite (evita gerar 30 e falhar no gate de quota depois).
 *
 * `durationSeconds` fica na assinatura por compatibilidade com os
 * call-sites existentes, mas não influencia mais o resultado.
 */
export function computeClipTarget(_durationSeconds: number, remainingRenders?: number): number {
    if (typeof remainingRenders === "number" && remainingRenders > 0) {
        return Math.max(1, Math.min(CLIP_TARGET_CEIL, remainingRenders));
    }
    return CLIP_TARGET_CEIL;
}
