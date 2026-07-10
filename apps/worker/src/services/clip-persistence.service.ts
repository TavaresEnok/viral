import { Injectable, Logger } from "@nestjs/common";
import type { ClipSuggestion, TranscriptPayload } from "@viralforge/clip-analyzer";
import type { WordSegment } from "@viralforge/render-engine";
import {
    safeFloat,
    safeFloatOrNull,
    safeInt,
    safeIntOrNull,
    safeString,
    safeStringOrNull,
} from "../types/pipeline.types.js";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class ClipPersistenceService {
    private readonly logger = new Logger(ClipPersistenceService.name);

    constructor(private readonly prisma: PrismaService) {}

    async persistClips(
        projectId: string,
        clips: ClipSuggestion[],
        log: (msg: string, extra?: Record<string, unknown>) => void,
    ): Promise<void> {
        try {
            await this.prisma.$transaction([
                this.prisma.clip.deleteMany({ where: { projectId } }),
                ...this.buildClipCreateOps(projectId, clips),
            ]);
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn({
                msg: "Transação de SAVING_CLIPS falhou; salvando corte a corte",
                projectId,
                error: message,
            });

            await this.prisma.clip.deleteMany({ where: { projectId } });
            const rows = this.buildClipData(projectId, clips);
            let saved = 0;
            let skipped = 0;
            for (const data of rows) {
                try {
                    await this.prisma.clip.create({ data });
                    saved += 1;
                } catch (clipError) {
                    skipped += 1;
                    this.logger.warn({
                        msg: "Corte descartado por erro ao salvar",
                        projectId,
                        title: data.title,
                        error: clipError instanceof Error ? clipError.message : String(clipError),
                    });
                }
            }

            if (saved === 0) throw error;

            log(`Cortes salvos com recuperação: ${saved} ok, ${skipped} descartados`, {
                stage: "SAVING_CLIPS",
                saved,
                skipped,
            });
        }
    }

    buildClipCreateOps(projectId: string, clips: ClipSuggestion[]) {
        return this.buildClipData(projectId, clips).map((data) =>
            this.prisma.clip.create({ data }),
        );
    }

    buildClipData(projectId: string, clips: ClipSuggestion[]) {
        const scoredClips = clips
            .map((clip) => ({ clip, score: this.computeFinalScore(clip) }))
            .sort((a, b) => b.score.rankScore - a.score.rankScore);

        return scoredClips.map(({ clip, score }) => ({
            projectId,
            title: safeString(clip.title, "Corte"),
            suggestedStart: safeFloat(clip.start),
            suggestedEnd: safeFloat(clip.end),
            start: safeFloat(clip.start),
            end: safeFloat(clip.end),
            duration: safeFloat(clip.duration),
            viralScore: safeInt(clip.viral_score),
            finalScore: safeInt(score.finalScore),
            scoreBreakdown: score.breakdown as never,
            openingStrength: safeIntOrNull(clip.opening_strength),
            contextIndependenceScore: safeIntOrNull(clip.context_independence_score),
            emotionalDensity: safeIntOrNull(clip.emotional_density),
            quotability: safeIntOrNull(clip.quotability),
            riskOfBadCut: safeStringOrNull(clip.risk_of_bad_cut),
            needsReview: Boolean(clip.needs_review),
            textSimilarity: safeFloatOrNull(clip.text_similarity),
            detectedWeakEnding: Boolean(clip.detected_weak_ending),
            detectedLastWords: safeStringOrNull(clip.detected_last_words),
            wasAdjustedByAi: Boolean(clip.was_adjusted_by_ai),
            adjustmentNotes: safeStringOrNull(clip.adjustment_notes),
            suggestedCaptionTitle: safeStringOrNull(clip.suggested_caption_title),
            firstThreeSecondsHook: safeStringOrNull(clip.first_three_seconds_hook),
            shareabilityReason: safeStringOrNull(clip.shareability_reason),
            actualTextInClip: safeStringOrNull(clip.actual_text_in_clip),
            evaluationNotes: clip.evaluation_notes ? (clip.evaluation_notes as never) : undefined,
            closingStrength: safeIntOrNull(clip.closing_strength),
            closingType: safeStringOrNull(clip.closing_type),
            category: safeString(clip.category, "geral"),
            hook: safeStringOrNull(clip.hook),
            reason: safeString(clip.reason, ""),
            renderLayout: null,
            captionTheme: null,
            status: "PENDING" as const,
        }));
    }

    computeFinalScore(clip: ClipSuggestion) {
        const viral = safeInt(clip.viral_score);
        const opening = safeInt(clip.opening_strength ?? clip.viral_score);
        const closing = safeInt(clip.closing_strength ?? clip.viral_score);
        const context = safeInt(clip.context_independence_score ?? clip.viral_score);
        const emotional = safeInt(clip.emotional_density ?? clip.viral_score);
        const quotability = safeInt(clip.quotability ?? clip.viral_score);
        const text = `${clip.hook ?? ""} ${clip.actual_text_in_clip ?? ""}`.toLowerCase();
        const localBoosts = this.computeLocalBoosts(text, clip);
        const penalties = this.computeScorePenalties(clip);
        const weighted =
            opening * 0.3 +
            closing * 0.3 +
            quotability * 0.2 +
            context * 0.1 +
            emotional * 0.1;
        const rankScore = Math.max(
            0,
            Math.min(100, Math.round(weighted + localBoosts.total - penalties.total)),
        );
        const finalScore = this.toDisplayScore(rankScore);

        return {
            finalScore,
            rankScore,
            breakdown: {
                weighted: Math.round(weighted),
                rankScore,
                displayScore: finalScore,
                viral,
                opening,
                closing,
                context,
                emotional,
                quotability,
                boosts: localBoosts,
                penalties,
            },
        };
    }

    private toDisplayScore(internal: number): number {
        const anchors: Array<[number, number]> = [
            [0, 35],
            [40, 72],
            [55, 82],
            [70, 89],
            [85, 95],
            [100, 99],
        ];
        const x = Math.max(0, Math.min(100, internal));
        for (let i = 1; i < anchors.length; i += 1) {
            const [x0, y0] = anchors[i - 1];
            const [x1, y1] = anchors[i];
            if (x <= x1) {
                const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
                return Math.round(y0 + t * (y1 - y0));
            }
        }
        return anchors[anchors.length - 1][1];
    }

    private computeLocalBoosts(text: string, clip: ClipSuggestion) {
        const items: Record<string, number> = {};
        if (/\d/.test(text)) items.specificNumber = 2;
        if (/\b(nunca|jamais|absurdo|impossivel|impossível|segredo|erro|perdi|falha|cuidado)\b/i.test(text))
            items.strongLanguage = 3;
        if (/\?/.test(text) || /\b(por que|como|quando|quanto)\b/i.test(text))
            items.questionHook = 2;
        if (
            clip.closing_type &&
            ["punchline", "thesis", "question"].includes(clip.closing_type)
        )
            items.strongClosingType = 3;
        const total = Object.values(items).reduce((sum, value) => sum + value, 0);
        return { total: Math.min(8, total), ...items };
    }

    private computeScorePenalties(clip: ClipSuggestion) {
        const items: Record<string, number> = {};
        if (clip.risk_of_bad_cut === "high") items.highCutRisk = 10;
        if (clip.risk_of_bad_cut === "medium") items.mediumCutRisk = 4;
        if (clip.detected_weak_ending) items.weakEnding = 8;
        if ((clip.text_similarity ?? 1) < 0.8) items.lowTextSimilarity = 6;
        if (clip.duration < 20 || clip.duration > 75) items.durationOutsideIdeal = 3;
        const total = Object.values(items).reduce((sum, value) => sum + value, 0);
        return { total, ...items };
    }

    buildOperationalFallbackClips(
        transcript: TranscriptPayload & { words?: WordSegment[] },
        preferredDuration: number,
        videoDuration: number,
        maxClips = 5,
    ): ClipSuggestion[] {
        const limit = Math.max(1, maxClips);
        const targetDuration = Math.min(75, Math.max(35, preferredDuration || 45));
        const segments = transcript.segments
            .filter((segment) => segment.end > segment.start && segment.text.trim().length >= 8)
            .sort((a, b) => a.start - b.start);
        const clips: ClipSuggestion[] = [];
        let nextAllowedStart = 0;

        for (const segment of segments) {
            if (clips.length >= limit) break;
            if (segment.start < nextAllowedStart || segment.start >= videoDuration - 15) continue;

            const start = Math.max(0, segment.start);
            const desiredEnd = Math.min(videoDuration, start + targetDuration);
            const windowSegments = segments.filter(
                (candidate) => candidate.start < desiredEnd && candidate.end > start,
            );
            if (!windowSegments.length) continue;

            const lastSegment = windowSegments.at(-1)!;
            const end = Math.min(videoDuration, Math.max(lastSegment.end, start + 15));
            const duration = Math.round(end - start);
            if (duration < 15 || duration > 90) continue;

            const actualText = windowSegments
                .map((candidate) => candidate.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
            if (actualText.length < 80) continue;

            const title = this.buildFallbackTitle(actualText, clips.length + 1);
            clips.push({
                title,
                start,
                end,
                duration,
                viral_score: Math.max(70, 78 - clips.length * 2),
                opening_strength: 70,
                closing_strength: 65,
                context_independence_score: 65,
                emotional_density: 60,
                quotability: 60,
                risk_of_bad_cut: "high",
                suggested_caption_title: title.slice(0, 80),
                first_three_seconds_hook:
                    "Fallback operacional: revisar abertura antes de publicar.",
                shareability_reason:
                    "Gerado para não travar o pipeline quando a IA/transcrição não retorna cortes válidos.",
                actual_text_in_clip: actualText.slice(0, 4000),
                evaluation_notes: {
                    hook_real: actualText.split(/[.!?]/).find(Boolean)?.trim().slice(0, 500),
                    hook_check: "Fallback operacional sem curadoria editorial profunda.",
                    closing_real: actualText.split(/[.!?]/).filter(Boolean).at(-1)?.trim().slice(0, 500),
                    closing_check: "Precisa de revisão manual antes de postar.",
                    context_check:
                        "Criado para preservar o fluxo de renderização quando a IA falha.",
                    emotional_pull: "Não avaliado por IA.",
                    verdict: "adjust_timestamps",
                },
                closing_type: "weak",
                needs_review: true,
                was_adjusted_by_ai: false,
                category: "fallback-review",
                hook: actualText.split(/[.!?]/).find(Boolean)?.trim().slice(0, 180),
                reason: "Fallback operacional: a IA não entregou cortes válidos. Corte criado para revisão manual e re-render sem bloquear o projeto.",
            });

            nextAllowedStart = end + Math.max(10, targetDuration * 0.5);
        }

        return clips;
    }

    private buildFallbackTitle(text: string, index: number): string {
        const firstSentence = text
            .split(/[.!?]/)
            .map((part) => part.trim())
            .find((part) => part.length >= 10);
        const title = firstSentence ?? `Corte para revisão ${index}`;
        return title.length > 80 ? `${title.slice(0, 77).trim()}...` : title;
    }
}
