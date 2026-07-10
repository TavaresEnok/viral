import { z } from 'zod';

export const clipSuggestionSchema = z
  .object({
    title: z.string().min(5).max(120),
    start: z.number().nonnegative(),
    end: z.number(),
    duration: z.number().int().min(15).max(90),
    viral_score: z.number().min(0).max(100),
    opening_strength: z.number().min(0).max(100).optional(),
    context_independence_score: z.number().min(0).max(100).optional(),
    emotional_density: z.number().min(0).max(100).optional(),
    quotability: z.number().min(0).max(100).optional(),
    risk_of_bad_cut: z.enum(['low', 'medium', 'high']).optional(),
    suggested_caption_title: z.string().min(3).max(80).optional(),
    first_three_seconds_hook: z.string().min(3).max(180).optional(),
    shareability_reason: z.string().min(5).max(500).optional(),
    actual_text_in_clip: z.string().min(20).max(4000).optional(),
    evaluation_notes: z
      .object({
        hook_real: z.string().min(3).max(500).optional(),
        hook_check: z.string().min(3).max(500).optional(),
        closing_real: z.string().min(3).max(500).optional(),
        closing_check: z.string().min(3).max(500).optional(),
        context_check: z.string().min(3).max(500).optional(),
        emotional_pull: z.string().min(3).max(500).optional(),
        verdict: z.enum(['include', 'discard', 'adjust_timestamps']).optional(),
      })
      .optional(),
    closing_strength: z.number().min(0).max(100).optional(),
    closing_type: z
      .enum(['conclusion', 'punchline', 'question', 'turn', 'thesis', 'weak'])
      .optional(),
    needs_review: z.boolean().optional(),
    text_similarity: z.number().min(0).max(1).optional(),
    detected_weak_ending: z.boolean().optional(),
    detected_last_words: z.string().max(120).optional(),
    was_adjusted_by_ai: z.boolean().optional(),
    adjustment_notes: z.string().max(600).optional(),
    category: z.string(),
    hook: z.string().optional(),
    reason: z.string().min(10).max(500),
  })
  .refine((clip) => clip.end > clip.start, 'end deve ser > start');

export const clipSuggestionResponseSchema = z.object({
  // Teto alinhado ao ceiling de maxClips do LlmClipAnalyzerService.
  clips: z.array(clipSuggestionSchema).max(30),
});

export type ClipSuggestion = z.infer<typeof clipSuggestionSchema>;
export type ClipSuggestionResponse = z.infer<typeof clipSuggestionResponseSchema>;
