import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

import {
  clipSuggestionSchema,
  clipSuggestionResponseSchema,
  type ClipSuggestion,
} from './schemas/clip-suggestion.schema.js';
import { parseJsonResilient } from './json-parsing.js';
import { loadContentProfile } from './content-profiles/index.js';
import type { TranscriptSegment } from './types.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(MODULE_DIR, 'prompts');
const MAX_SEGMENTS = 420;
const MAX_BLOCK_CHARS = 70_000;

// --- Controle de custo/latência da chamada ao LLM -------------------------
// Sem teto, um transcript grande + retries podia gerar custo ilimitado.
// O custo por análise fica limitado a: (input estimado + MAX_OUTPUT_TOKENS).
const MAX_OUTPUT_TOKENS = Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 8_000);
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 120_000);
// Teto de custo projetado por análise (USD). 0 desativa a checagem.
const MAX_COST_USD = Number(process.env.LLM_MAX_COST_USD ?? 0.5);
// ~4 caracteres por token é a aproximação usual para PT/EN.
const CHARS_PER_TOKEN = 4;

// --- Análise de vídeos longos -------------------------------------------
// Acima de MAX_SEGMENTS a transcrição não cabe numa chamada. A estratégia
// antiga era AMOSTRAR (descartando trechos inteiros — o melhor corte podia
// nunca ser visto pelo modelo). Com map-reduce, cada janela é analisada e os
// candidatos são consolidados no fim. LLM_MAP_REDUCE=false volta ao antigo.
const MAP_REDUCE_ENABLED = (process.env.LLM_MAP_REDUCE ?? 'true') !== 'false';
// Sobreposição entre janelas para não cortar um bom momento na fronteira.
const WINDOW_OVERLAP_SEGMENTS = 12;
// Acima disso dois candidatos são considerados o mesmo corte (fração da
// duração do menor). Usado ao consolidar janelas com sobreposição.
const DEDUPE_OVERLAP_RATIO = 0.5;

/**
 * Preço em USD por 1k tokens. Fonte única da verdade — o worker importa daqui
 * em vez de manter uma cópia própria da tabela.
 */
export const MODEL_COST_PER_1K: Record<string, number> = {
  'deepseek-chat': 0.00027,
  'deepseek-reasoner': 0.00055,
  'gpt-4o-mini': 0.00015,
  'gpt-4o': 0.0025,
  'claude-3-haiku-20240307': 0.00025,
  'claude-3-sonnet-20240229': 0.003,
  'gemini/gemini-2.0-flash-001': 0.00015,
};

/** Preço por 1k tokens do modelo, com fallback conservador para desconhecidos. */
export function modelCostPer1k(model: string): number {
  return MODEL_COST_PER_1K[model] ?? 0.001;
}
const DURATION_CLAMP_TOLERANCE_S = 5;

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('429') ||
          err.message.toLowerCase().includes('rate') ||
          err.message.toLowerCase().includes('timeout') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('ENOTFOUND'));
      if (!isRetryable || attempt === maxAttempts) throw err;
      await new Promise((res) => setTimeout(res, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

type Logger = (message: string) => void;

export interface TranscriptPayload {
  title?: string;
  language?: string;
  duration?: number;
  fullText?: string;
  segments: TranscriptSegment[];
}

export interface AnalyzeTranscriptInput {
  transcript: TranscriptPayload;
  clipStyle: string;
  language: string;
  preferredDuration?: number;
  maxClips?: number;
  minViralScore?: number;
  offline?: boolean;
  contentType?: string;
  /** Orientações derivadas do histórico de feedback do usuário (opcional). */
  feedbackNotes?: string;
}

export interface LlmProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export interface LlmClipAnalyzerServiceOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  logger?: Logger;
}

export interface LlmTelemetry {
  pass1Tokens: number;
  pass2Tokens: number;
  totalTokens: number;
  pass1Model: string;
  pass2Model: string;
  pass1CandidateCount: number;
  pass2ClipCount: number;
  approvedClipCount: number;
  pass1Failed: boolean;
  pass2Failed: boolean;
  rejectionRate: number;
}

export class LlmClipAnalyzerService {
  private readonly model: string;
  private readonly logger: Logger;
  private readonly client?: OpenAI;
  private readonly promptCache = new Map<string, string>();

  constructor(options: LlmClipAnalyzerServiceOptions = {}) {
    const config = {
      apiKey: options.apiKey ?? process.env.DEEPSEEK_API_KEY,
      baseURL: options.baseURL ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
      model: options.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    };

    this.model = config.model ?? 'deepseek-chat';
    this.logger = options.logger ?? ((message: string) => console.log(message));
    this.client = this.createClient(config);
  }

  private createClient(config: LlmProviderConfig): OpenAI | undefined {
    if (!config.apiKey) {
      return undefined;
    }

    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? 'https://api.deepseek.com',
      // Timeout explícito: sem isso uma chamada pendurada trava o job inteiro.
      timeout: LLM_TIMEOUT_MS,
      // O retry é feito por withRetry() aqui. Deixar o retry do SDK ligado
      // multiplicava as tentativas (3 x 3 = até 9 chamadas pagas por análise).
      maxRetries: 0,
    });
  }

  async analyzeTranscript(input: AnalyzeTranscriptInput): Promise<{ clips: ClipSuggestion[]; telemetry: LlmTelemetry }> {
    // Teto de 30 (alvo dinâmico vem do worker, ~1 corte/3,5min até 20). Era
    // travado em 5, o que perdia feio pra Opus Clip/Vizard em vídeos longos.
    const maxClips = Math.max(1, Math.min(input.maxClips ?? 5, 30));

    if (!input.transcript.segments.length) {
      this.logger('[llm-clip-analyzer] transcript sem segmentos, retornando []');
      return { clips: [], telemetry: this.emptyTelemetry() };
    }

    if (input.offline) {
      return { clips: await this.buildOfflineClips(input.transcript, maxClips), telemetry: this.emptyTelemetry() };
    }

    if (!this.client) {
      throw new Error('Provider de IA não configurado.');
    }

    const preferredDuration = input.preferredDuration ?? 45;
    const [systemPrompt, userTemplate] = await Promise.all([
      this.loadPrompt('system.txt'),
      this.loadPrompt('user-template.txt'),
    ]);
    const contentProfile = await loadContentProfile(input.contentType, input.clipStyle);
    const systemWithProfile = systemPrompt.replace('{contentProfile}', contentProfile);

    const feedbackSection = input.feedbackNotes?.trim()
      ? `\n\n# HISTÓRICO DE FEEDBACK DESTE USUÁRIO\n\nAjuste sua severidade com base nas rejeições anteriores deste usuário:\n\n${input.feedbackNotes.trim()}`
      : '';

    // Vídeo longo: analisa em janelas em vez de amostrar a transcrição inteira.
    // Vídeo curto cai numa única janela e o comportamento é idêntico ao anterior.
    const windows = MAP_REDUCE_ENABLED
      ? this.buildAnalysisWindows(input.transcript.segments)
      : [input.transcript.segments];
    const useMapReduce = windows.length > 1;

    const buildUserPrompt = (segments: TranscriptSegment[], clipsWanted: number) =>
      userTemplate
        .replace('{clipStyle}', input.clipStyle)
        .replace('{language}', input.language)
        .replace('{preferredDuration}', String(preferredDuration))
        .replace('{maxClips}', String(clipsWanted))
        .replace('{transcriptBlock}', this.buildTranscriptBlock({ ...input.transcript, segments })) +
      feedbackSection;

    // Cada janela busca um pouco mais que a fatia proporcional, para o ranking
    // final ter margem de escolha entre janelas.
    const clipsPerWindow = useMapReduce
      ? Math.max(2, Math.ceil((maxClips / windows.length) * 1.5))
      : maxClips;
    const userPrompts = windows.map((segments) => buildUserPrompt(segments, clipsPerWindow));

    this.assertWithinCostBudget(systemWithProfile, userPrompts);

    if (useMapReduce) {
      this.logger(
        `[clip-analyzer] transcrição longa (${input.transcript.segments.length} segmentos): ` +
          `analisando em ${windows.length} janelas de até ${clipsPerWindow} cortes cada`,
      );
    }

    let tokensUsed = 0;
    let failedPasses = 0;
    const rawCandidates: ClipSuggestion[] = [];
    for (const [index, userPrompt] of userPrompts.entries()) {
      const pass = await this.runAnalysisPass(systemWithProfile, userPrompt, index, userPrompts.length);
      tokensUsed += pass.tokensUsed;
      if (pass.failed) {
        failedPasses += 1;
        continue;
      }
      rawCandidates.push(...pass.clips);
    }

    // Janelas com sobreposição podem sugerir o mesmo momento duas vezes.
    const clips = useMapReduce ? this.mergeWindowCandidates(rawCandidates) : rawCandidates;

    const telemetry: LlmTelemetry = {
      pass1Tokens: tokensUsed,
      pass2Tokens: 0,
      totalTokens: tokensUsed,
      pass1Model: this.model,
      pass2Model: '',
      pass1CandidateCount: clips.length,
      pass2ClipCount: 0,
      approvedClipCount: 0,
      // Só é falha de verdade se nenhuma janela produziu candidato.
      pass1Failed: failedPasses > 0 && clips.length === 0,
      pass2Failed: false,
      rejectionRate: 1,
    };

    if (!clips.length) {
      return { clips: [], telemetry };
    }

    const validatedClips = this.applySemanticValidation(clips, input.transcript, {
      maxClips,
      minViralScore: input.minViralScore ?? 0,
    });
    telemetry.approvedClipCount = validatedClips.length;
    telemetry.rejectionRate = clips.length > 0 ? 1 - validatedClips.length / clips.length : 1;
    this.logger(
      `[clip-analyzer] ${useMapReduce ? `map-reduce (${windows.length} janelas)` : 'avaliação única'}: ` +
        `${validatedClips.length} clips aprovados de ${clips.length} candidatos`,
    );

    return { clips: validatedClips, telemetry };
  }

  /**
   * Divide os segmentos em janelas que cabem numa chamada, respeitando tanto o
   * limite de segmentos quanto o de caracteres, com sobreposição entre janelas.
   * Retorna uma única janela quando a transcrição inteira já cabe.
   */
  private buildAnalysisWindows(segments: TranscriptSegment[]): TranscriptSegment[][] {
    const totalChars = segments.reduce((sum, s) => sum + s.text.length + 24, 0);
    if (segments.length <= MAX_SEGMENTS && totalChars <= MAX_BLOCK_CHARS) {
      return [segments];
    }

    const windows: TranscriptSegment[][] = [];
    let index = 0;
    while (index < segments.length) {
      const window: TranscriptSegment[] = [];
      let chars = 0;
      while (index < segments.length && window.length < MAX_SEGMENTS) {
        const segmentChars = segments[index].text.length + 24;
        if (chars + segmentChars > MAX_BLOCK_CHARS && window.length > 0) break;
        window.push(segments[index]);
        chars += segmentChars;
        index += 1;
      }
      windows.push(window);
      if (index >= segments.length) break;
      // Recua para sobrepor com a janela seguinte.
      index = Math.max(index - WINDOW_OVERLAP_SEGMENTS, index - window.length + 1);
    }
    return windows;
  }

  /**
   * Consolida candidatos de várias janelas: remove duplicatas por sobreposição
   * temporal (mantendo o de maior viral_score) e ordena por score.
   */
  private mergeWindowCandidates(candidates: ClipSuggestion[]): ClipSuggestion[] {
    const ordered = [...candidates].sort((a, b) => b.viral_score - a.viral_score);
    const kept: ClipSuggestion[] = [];

    for (const candidate of ordered) {
      const duplicate = kept.some((existing) => {
        const overlap =
          Math.min(existing.end, candidate.end) - Math.max(existing.start, candidate.start);
        if (overlap <= 0) return false;
        const shorter = Math.min(existing.end - existing.start, candidate.end - candidate.start);
        return shorter > 0 && overlap / shorter >= DEDUPE_OVERLAP_RATIO;
      });
      // Como já vem ordenado por score, o primeiro a ocupar a faixa é o melhor.
      if (!duplicate) kept.push(candidate);
    }

    return kept;
  }

  /**
   * Falha antes de gastar se o custo projetado do conjunto de chamadas passar do
   * teto. Considera todas as janelas — o teto é por análise, não por chamada.
   */
  private assertWithinCostBudget(systemPrompt: string, userPrompts: string[]): void {
    const inputChars = userPrompts.reduce(
      (sum, prompt) => sum + prompt.length + systemPrompt.length,
      0,
    );
    const estimatedInputTokens = Math.ceil(inputChars / CHARS_PER_TOKEN);
    const outputTokens = MAX_OUTPUT_TOKENS * userPrompts.length;
    const projectedCostUsd =
      ((estimatedInputTokens + outputTokens) / 1000) * modelCostPer1k(this.model);

    if (MAX_COST_USD > 0 && projectedCostUsd > MAX_COST_USD) {
      throw new Error(
        `Custo projetado da análise (US$ ${projectedCostUsd.toFixed(4)} em ${userPrompts.length} ` +
          `chamada(s)) excede o teto LLM_MAX_COST_USD=${MAX_COST_USD}. Use um vídeo mais curto, ` +
          `um modelo mais barato ou aumente o teto (modelo atual: ${this.model}).`,
      );
    }

    this.logger(
      `[clip-analyzer] custo projetado US$ ${projectedCostUsd.toFixed(4)} ` +
        `(~${estimatedInputTokens} tokens de entrada em ${userPrompts.length} chamada(s))`,
    );
  }

  /** Executa uma chamada ao modelo e devolve os candidatos daquela janela. */
  private async runAnalysisPass(
    systemPrompt: string,
    userPrompt: string,
    index: number,
    total: number,
  ): Promise<{ clips: ClipSuggestion[]; tokensUsed: number; failed: boolean }> {
    const label = total > 1 ? `janela ${index + 1}/${total}` : 'passada única';

    const createCompletion = (jsonMode: boolean) =>
      this.client!.chat.completions.create({
        model: this.model,
        temperature: 0.3,
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

    let tokensUsed = 0;
    let rawContent = '';
    try {
      let completion;
      try {
        completion = await withRetry(() => createCompletion(true));
      } catch (error) {
        // Nem todo provider OpenAI-compat do PlatformAiConfig aceita response_format.
        const message = (error as Error).message ?? '';
        if (!/response_format|unsupported|invalid.*(parameter|argument)/i.test(message)) {
          throw error;
        }
        this.logger(`[clip-analyzer] provider rejeitou json_object, repetindo sem JSON mode: ${message}`);
        completion = await withRetry(() => createCompletion(false));
      }
      tokensUsed = completion.usage?.total_tokens ?? 0;
      rawContent = completion.choices[0]?.message?.content ?? '';
    } catch (error) {
      this.logger(
        `[clip-analyzer] ${label}: chamada ao provider falhou após retries: ${(error as Error).message}`,
      );
      return { clips: [], tokensUsed, failed: true };
    }

    const parsedResponse = this.parseModelResponse(rawContent);
    if (!parsedResponse) {
      // Resposta ilegível é problema de qualidade do modelo, não falha de
      // chamada — `failed` sinaliza apenas erro de comunicação com o provider.
      this.logger(`[llm-clip-analyzer] ${label}: resposta inválida após fallback de parsing`);
      return { clips: [], tokensUsed, failed: false };
    }

    const clips = this.parseClipSuggestions(parsedResponse);
    if (!clips.length) {
      // Observabilidade: quando o modelo não produz cortes, loga o modelo e um
      // trecho da resposta. Isso evidencia modelo fraco/incapaz (ex.: modelos
      // grátis pequenos) devolvendo {"clips":[]} ou JSON fora do schema.
      this.logger(
        `[llm-clip-analyzer] ${label}: modelo "${this.model}" não produziu cortes válidos. ` +
          `Trecho da resposta: ${rawContent.slice(0, 400).replace(/\s+/g, ' ').trim()}`,
      );
      const validationResult = clipSuggestionResponseSchema.safeParse(parsedResponse);
      if (!validationResult.success) {
        this.logger(
          `[llm-clip-analyzer] ${label}: resposta fora do schema: ${validationResult.error.issues
            .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('; ')}`,
        );
      }
    }

    return { clips, tokensUsed, failed: false };
  }

  private emptyTelemetry(): LlmTelemetry {
    return {
      pass1Tokens: 0,
      pass2Tokens: 0,
      totalTokens: 0,
      pass1Model: '',
      pass2Model: '',
      pass1CandidateCount: 0,
      pass2ClipCount: 0,
      approvedClipCount: 0,
      pass1Failed: false,
      pass2Failed: false,
      rejectionRate: 1,
    };
  }

  private async loadPrompt(filename: string): Promise<string> {
    const cached = this.promptCache.get(filename);
    if (cached) {
      return cached;
    }

    const fullPath = resolve(PROMPTS_DIR, filename);
    const content = await readFile(fullPath, 'utf8');
    this.promptCache.set(filename, content);
    return content;
  }

  private buildTranscriptBlock(transcript: TranscriptPayload): string {
    const selectedSegments = this.selectSegments(transcript);
    return selectedSegments
      .map((segment) => {
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        return `[${segment.start.toFixed(1)}-${segment.end.toFixed(1)}] ${speaker}${segment.text}`;
      })
      .join('\n');
  }

  private selectSegments(transcript: TranscriptPayload): TranscriptSegment[] {
    const segments = transcript.segments.filter((segment) => segment.end > segment.start && segment.text.trim().length >= 8);
    if (segments.length <= MAX_SEGMENTS) {
      return segments;
    }

    const duration = this.getTranscriptDuration(transcript);
    const bucketSize = Math.max(30, Math.ceil(duration / 24));
    const buckets = new Map<number, Array<{ segment: TranscriptSegment; score: number }>>();

    for (const segment of segments) {
      const bucket = Math.floor(segment.start / bucketSize);
      const score = this.segmentViralityScore(segment.text);
      const list = buckets.get(bucket) ?? [];
      list.push({ segment, score });
      buckets.set(bucket, list);
    }

    const picked: TranscriptSegment[] = [];
    for (const list of buckets.values()) {
      list.sort((a, b) => b.score - a.score);
      picked.push(...list.slice(0, 18).map((item) => item.segment));
    }

    picked.sort((a, b) => a.start - b.start);
    const deduped = picked.filter((segment, index) => {
      const previous = picked[index - 1];
      return !previous || previous.start !== segment.start || previous.end !== segment.end || previous.text !== segment.text;
    });

    const withGlobalCoverage = [
      ...deduped,
      ...this.uniformSample(segments, 42),
    ]
      .sort((a, b) => a.start - b.start)
      .filter((segment, index, array) => {
        const previous = array[index - 1];
        return !previous || previous.start !== segment.start || previous.end !== segment.end || previous.text !== segment.text;
      });

    const limitedByCount = withGlobalCoverage.slice(0, MAX_SEGMENTS);
    const limitedByChars: TranscriptSegment[] = [];
    let totalChars = 0;
    for (const segment of limitedByCount) {
      const lineLength = segment.text.length + 32;
      if (totalChars + lineLength > MAX_BLOCK_CHARS) {
        break;
      }
      limitedByChars.push(segment);
      totalChars += lineLength;
    }

    if (limitedByChars.length >= 120) {
      this.logger(
        `[clip-analyzer] pre-filter de segmentos: ${segments.length} -> ${limitedByChars.length} segmentos (${Math.round((limitedByChars.length / segments.length) * 100)}%)`,
      );
      return limitedByChars;
    }

    return this.uniformSample(segments, MAX_SEGMENTS);
  }

  private segmentViralityScore(text: string): number {
    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const words = normalized.split(/\s+/).filter(Boolean);
    let score = Math.min(25, words.length * 0.8);
    if (/[!?]/.test(text)) score += 8;
    if (/\d/.test(text)) score += 6;
    if (/[A-Z]{2,}/.test(text)) score += 4;

    const triggerPatterns = [
      /\b(segredo|ninguem te conta|nunca contei|aconteceu comigo)\b/i,
      /\b(erro|falha|perdi|quebrei|banido|demitido)\b/i,
      /\b(agora|hoje|serio|realmente|impressionante)\b/i,
      /\b(nao fac(a|o)|pare|evite|cuidado)\b/i,
      /\b(como|por que|porque|quando|quanto)\b/i,
    ];
    for (const pattern of triggerPatterns) {
      if (pattern.test(normalized)) score += 6;
    }

    const repetitionPenalty = this.repetitionPenalty(words);
    return score - repetitionPenalty;
  }

  private repetitionPenalty(words: string[]): number {
    if (words.length < 6) return 0;
    let repeats = 0;
    for (let i = 1; i < words.length; i += 1) {
      if (words[i] === words[i - 1]) repeats += 1;
    }
    return Math.min(20, repeats * 3);
  }

  private uniformSample<T>(values: T[], target: number): T[] {
    if (values.length <= target) return values;
    const sample: T[] = [];
    for (let i = 0; i < target; i += 1) {
      const index = Math.min(values.length - 1, Math.floor((i / target) * values.length));
      sample.push(values[index]);
    }
    return sample;
  }

  private rankingScore(scores: Required<Pick<ClipSuggestion, 'opening_strength' | 'closing_strength' | 'context_independence_score' | 'emotional_density' | 'quotability'>>): number {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          scores.opening_strength * 0.3 +
            scores.closing_strength * 0.3 +
            scores.quotability * 0.2 +
            scores.emotional_density * 0.1 +
            scores.context_independence_score * 0.1,
        ),
      ),
    );
  }

  private parseModelResponse(raw: string): unknown | null {
    if (!raw.trim()) {
      this.logger('[llm-clip-analyzer] resposta vazia do modelo');
      return null;
    }
    return parseJsonResilient(raw);
  }

  private parseClipSuggestions(value: unknown): ClipSuggestion[] {
    if (!value || typeof value !== 'object' || !('clips' in value)) {
      return [];
    }

    const rawClips = (value as { clips: unknown }).clips;
    if (!Array.isArray(rawClips)) {
      return [];
    }

    const valid: ClipSuggestion[] = [];
    let invalid = 0;

    for (const rawClip of rawClips) {
      const normalized = this.normalizeRawClip(rawClip);
      const parsed = clipSuggestionSchema.safeParse(normalized);
      if (parsed.success) {
        valid.push(parsed.data);
      } else {
        invalid += 1;
      }
    }

    if (invalid > 0) {
      this.logger(`[llm-clip-analyzer] ${invalid} clip(s) inválido(s) foram descartados, ${valid.length} aproveitado(s)`);
    }

    return valid;
  }

  private normalizeRawClip(rawClip: unknown): unknown {
    if (!rawClip || typeof rawClip !== 'object') {
      return rawClip;
    }

    const clip = rawClip as Record<string, unknown>;
    const start = this.toNumber(clip.start);
    const rawEnd = this.toNumber(clip.end);
    const rawDuration = this.toInteger(clip.duration);
    const endFromDuration = start !== null && rawDuration !== null ? start + rawDuration : null;
    const normalizedEnd = rawEnd ?? endFromDuration;
    const durationBeforeClamp = start !== null && normalizedEnd !== null ? Math.round(normalizedEnd - start) : null;
    // Clamp só dentro da tolerância: arrastar o end de uma sugestão muito fora
    // de 15-90s cortaria a fala no meio; fora dela, deixa o schema descartar.
    const withinClampTolerance =
      durationBeforeClamp !== null &&
      durationBeforeClamp >= 15 - DURATION_CLAMP_TOLERANCE_S &&
      durationBeforeClamp <= 90 + DURATION_CLAMP_TOLERANCE_S;
    const end =
      start !== null && normalizedEnd !== null && withinClampTolerance
        ? start + Math.min(90, Math.max(15, durationBeforeClamp))
        : normalizedEnd;
    const computedDuration = start !== null && end !== null ? Math.round(end - start) : null;
    const title = this.toString(clip.title) ?? this.toString(clip.hook) ?? 'Corte viral';
    const reason =
      this.toString(clip.reason) ??
      this.toString(clip.hook) ??
      'Trecho com potencial de retenção e comentário.';
    const rawScores = clip.scores && typeof clip.scores === 'object' ? (clip.scores as Record<string, unknown>) : undefined;
    const opening =
      this.toNumber(rawScores?.opening_strength) ??
      this.toNumber(clip.opening_strength) ??
      this.toNumber(clip.openingStrength) ??
      this.toNumber(clip.viral_score) ??
      this.toNumber(clip.viralScore) ??
      0;
    const closing =
      this.toNumber(rawScores?.closing_strength) ??
      this.toNumber(clip.closing_strength) ??
      this.toNumber(clip.closingStrength) ??
      this.toNumber(clip.viral_score) ??
      this.toNumber(clip.viralScore) ??
      0;
    const context =
      this.toNumber(rawScores?.context_independence_score) ??
      this.toNumber(clip.context_independence_score) ??
      this.toNumber(clip.contextIndependenceScore) ??
      this.toNumber(clip.viral_score) ??
      this.toNumber(clip.viralScore) ??
      0;
    const emotional =
      this.toNumber(rawScores?.emotional_density) ??
      this.toNumber(clip.emotional_density) ??
      this.toNumber(clip.emotionalDensity);
    const quotability = this.toNumber(rawScores?.quotability) ?? this.toNumber(clip.quotability);
    const viralScore =
      this.toNumber(clip.viral_score) ??
      this.toNumber(clip.viralScore) ??
      this.rankingScore({
        opening_strength: opening,
        closing_strength: closing,
        context_independence_score: context,
        emotional_density: emotional ?? opening,
        quotability: quotability ?? opening,
      });

    return {
      title,
      start,
      end,
      duration: computedDuration,
      viral_score: viralScore,
      opening_strength: opening,
      context_independence_score: context,
      // toNumber() devolve null quando o campo não veio. O schema marca estes
      // dois como opcionais, mas `null` não satisfaz `z.number().optional()` —
      // o clip inteiro era descartado em silêncio quando o modelo omitia um
      // deles (comum em modelos menores), zerando a análise.
      emotional_density: emotional ?? undefined,
      quotability: quotability ?? undefined,
      risk_of_bad_cut: this.toRiskOfBadCut(clip.risk_of_bad_cut ?? clip.riskOfBadCut),
      suggested_caption_title: this.toString(clip.suggested_caption_title ?? clip.suggestedCaptionTitle),
      first_three_seconds_hook: this.toString(clip.first_three_seconds_hook ?? clip.firstThreeSecondsHook),
      shareability_reason: this.toString(clip.shareability_reason ?? clip.shareabilityReason),
      actual_text_in_clip: this.toString(clip.actual_text_in_clip ?? clip.actualTextInClip),
      evaluation_notes: this.toEvaluationNotes(clip.evaluation_notes ?? clip.evaluationNotes),
      closing_strength: closing,
      closing_type: this.toClosingType(clip.closing_type ?? clip.closingType),
      needs_review: this.toBoolean(clip.needs_review ?? clip.needsReview),
      text_similarity: this.toNumber(clip.text_similarity ?? clip.textSimilarity) ?? undefined,
      detected_weak_ending: this.toBoolean(clip.detected_weak_ending ?? clip.detectedWeakEnding),
      detected_last_words: this.toString(clip.detected_last_words ?? clip.detectedLastWords),
      was_adjusted_by_ai: this.toBoolean(clip.was_adjusted_by_ai ?? clip.wasAdjustedByAi ?? clip.was_adjusted),
      adjustment_notes: this.toString(clip.adjustment_notes ?? clip.adjustmentNotes),
      category: this.toString(clip.category) ?? this.toString(clip.type) ?? 'viral',
      hook: this.toString(clip.hook),
      reason,
    };
  }

  private toString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toInteger(value: unknown): number | null {
    const parsed = this.toNumber(value);
    return parsed === null ? null : Math.round(parsed);
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'sim'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) {
        return false;
      }
    }
    return undefined;
  }

  private toRiskOfBadCut(value: unknown): ClipSuggestion['risk_of_bad_cut'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (['low', 'medium', 'high'].includes(normalized)) {
      return normalized as ClipSuggestion['risk_of_bad_cut'];
    }
    return undefined;
  }

  private toClosingType(value: unknown): ClipSuggestion['closing_type'] {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (['conclusion', 'punchline', 'question', 'turn', 'thesis', 'weak'].includes(normalized)) {
      return normalized as ClipSuggestion['closing_type'];
    }
    return undefined;
  }

  private toEvaluationNotes(value: unknown): ClipSuggestion['evaluation_notes'] {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const notes = value as Record<string, unknown>;
    const verdict = this.toString(notes.verdict);
    return {
      hook_real: this.toString(notes.hook_real ?? notes.hookReal),
      hook_check: this.toString(notes.hook_check ?? notes.hookCheck ?? notes.first_three_seconds ?? notes.firstThreeSeconds),
      closing_real: this.toString(notes.closing_real ?? notes.closingReal),
      closing_check: this.toString(notes.closing_check ?? notes.closingCheck),
      context_check: this.toString(notes.context_check ?? notes.contextCheck),
      emotional_pull: this.toString(notes.emotional_pull ?? notes.emotionalPull),
      verdict: verdict && ['include', 'discard', 'adjust_timestamps'].includes(verdict)
        ? (verdict as NonNullable<ClipSuggestion['evaluation_notes']>['verdict'])
        : undefined,
    };
  }

  private applySemanticValidation(
    clips: ClipSuggestion[],
    transcript: TranscriptPayload,
    options: { maxClips: number; minViralScore: number },
  ): ClipSuggestion[] {
    const transcriptDuration = this.getTranscriptDuration(transcript);

    const normalized = clips
      .filter((clip) => clip.viral_score >= options.minViralScore)
      .map((clip) => {
        const computedDuration = Math.round(clip.end - clip.start);
        const actualText = this.clipTextFromSegments(clip, transcript.segments);
        return {
          ...clip,
          duration: computedDuration,
          title: clip.title.trim(),
          category: clip.category.trim(),
          hook: clip.hook?.trim(),
          reason: clip.reason.trim(),
          opening_strength: clip.opening_strength ?? clip.viral_score,
          context_independence_score: clip.context_independence_score ?? clip.viral_score,
          emotional_density: clip.emotional_density ?? clip.viral_score,
          quotability: clip.quotability ?? clip.viral_score,
          risk_of_bad_cut: clip.risk_of_bad_cut,
          suggested_caption_title: clip.suggested_caption_title?.trim(),
          first_three_seconds_hook: clip.first_three_seconds_hook?.trim(),
          shareability_reason: clip.shareability_reason?.trim(),
          actual_text_in_clip: (actualText || clip.actual_text_in_clip || '').trim().slice(0, 4000) || undefined,
          evaluation_notes: clip.evaluation_notes,
          needs_review: clip.needs_review,
          text_similarity: clip.text_similarity,
          detected_weak_ending: clip.detected_weak_ending,
          detected_last_words: clip.detected_last_words,
          was_adjusted_by_ai: clip.was_adjusted_by_ai,
          adjustment_notes: clip.adjustment_notes,
        } satisfies ClipSuggestion;
      })
      .filter((clip) => clip.end > clip.start)
      .filter((clip) => clip.duration >= 15 && clip.duration <= 90)
      .filter((clip) => clip.start <= transcriptDuration && clip.end <= transcriptDuration)
      .filter((clip) => this.clipTouchesTranscriptSegments(clip, transcript.segments));

    normalized.sort((a, b) => this.compositeScore(b, transcript.segments) - this.compositeScore(a, transcript.segments));

    const deduped: ClipSuggestion[] = [];
    for (const candidate of normalized) {
      const overlapsTooMuch = deduped.some((existing) => this.overlapRatio(existing, candidate) >= 0.75);
      if (!overlapsTooMuch) {
        deduped.push(candidate);
      }

      if (deduped.length >= options.maxClips) {
        break;
      }
    }

    return deduped;
  }

  private clipTouchesTranscriptSegments(clip: ClipSuggestion, segments: TranscriptSegment[]): boolean {
    return segments.some((segment) => {
      const overlap = Math.min(segment.end, clip.end) - Math.max(segment.start, clip.start);
      return overlap > 0;
    });
  }

  private overlapRatio(a: ClipSuggestion, b: ClipSuggestion): number {
    const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    const shorter = Math.min(a.end - a.start, b.end - b.start);
    if (shorter <= 0) {
      return 0;
    }

    return overlap / shorter;
  }

  private compositeScore(clip: ClipSuggestion, segments: TranscriptSegment[]): number {
    const opening = clip.opening_strength ?? clip.viral_score;
    const closing = clip.closing_strength ?? clip.viral_score;
    const context = clip.context_independence_score ?? clip.viral_score;
    const emotional = clip.emotional_density ?? clip.viral_score;
    const quotability = clip.quotability ?? clip.viral_score;
    const riskPenalty = clip.risk_of_bad_cut === 'high' ? 12 : clip.risk_of_bad_cut === 'medium' ? 5 : 0;
    const textBoost = this.editorialBoost(clip, segments);
    return opening * 0.3 + closing * 0.3 + quotability * 0.2 + emotional * 0.1 + context * 0.1 + textBoost - riskPenalty;
  }

  private editorialBoost(clip: ClipSuggestion, segments: TranscriptSegment[]): number {
    const text = (clip.actual_text_in_clip ?? this.clipTextFromSegments(clip, segments)).trim();
    if (!text) return 0;

    let boost = 0;
    const textLower = text.toLowerCase();
    const openingText = text.split(/[.!?]/).find(Boolean)?.trim().toLowerCase() ?? textLower.slice(0, 120);
    const endingText = text.split(/[.!?]/).filter(Boolean).at(-1)?.trim().toLowerCase() ?? '';

    if (/\b(nao|nunca|jamais|absurdo|impossivel)\b/i.test(openingText)) boost += 2.5;
    if (/\b(como|por que|porque|quando|quanto)\b/i.test(openingText)) boost += 2;
    if (/\d/.test(openingText)) boost += 1.5;
    if (/[!?]/.test(openingText)) boost += 1.5;

    if (/\b(portanto|por isso|resultado|conclusao|moral)\b/i.test(endingText)) boost += 1.5;
    if (/[.!?]$/.test(text)) boost += 1;

    if (clip.closing_type === 'punchline' || clip.closing_type === 'thesis' || clip.closing_type === 'question') boost += 1.5;

    return Math.min(8, boost);
  }

  private clipTextFromSegments(clip: ClipSuggestion, segments: TranscriptSegment[]): string {
    return segments
      .filter((segment) => segment.start < clip.end && segment.end > clip.start)
      .map((segment) => segment.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getTranscriptDuration(transcript: TranscriptPayload): number {
    if (typeof transcript.duration === 'number' && Number.isFinite(transcript.duration)) {
      return transcript.duration;
    }

    const lastEnd = transcript.segments.reduce((max, segment) => Math.max(max, segment.end), 0);
    return lastEnd;
  }

  private buildOfflineClips(transcript: TranscriptPayload, maxClips: number): ClipSuggestion[] {
    const windows: ClipSuggestion[] = [];
    let pointer = 0;
    const duration = this.getTranscriptDuration(transcript);

    while (pointer + 20 <= duration && windows.length < maxClips) {
      const start = pointer;
      const end = Math.min(pointer + 45, duration);
      const durationSeconds = Math.round(end - start);

      if (durationSeconds < 15 || durationSeconds > 90) {
        break;
      }

      const text = transcript.segments
        .filter((segment) => segment.start < end && segment.end > start)
        .map((segment) => segment.text)
        .join(' ')
        .slice(0, 140);

      windows.push({
        title: `Corte ${windows.length + 1}`,
        start,
        end,
        duration: durationSeconds,
        viral_score: Math.max(65, 92 - windows.length * 4),
        opening_strength: Math.max(65, 90 - windows.length * 3),
        closing_strength: Math.max(65, 88 - windows.length * 3),
        context_independence_score: Math.max(65, 85 - windows.length * 2),
        emotional_density: Math.max(65, 84 - windows.length * 2),
        quotability: Math.max(65, 82 - windows.length * 2),
        risk_of_bad_cut: 'low',
        suggested_caption_title: `Corte ${windows.length + 1}`,
        first_three_seconds_hook: 'Abertura sintética para validação offline.',
        shareability_reason: 'Preview offline para validar pipeline e render.',
        actual_text_in_clip: text,
        evaluation_notes: {
          hook_real: text.split(/[.!?]/)[0]?.trim(),
          hook_check: 'Abertura offline usada apenas para validar o pipeline.',
          closing_real: text.split(/[.!?]/).filter(Boolean).at(-1)?.trim(),
          closing_check: 'Fechamento offline aproximado.',
          context_check: 'Sem avaliação real em modo offline.',
          emotional_pull: 'Sem avaliação real em modo offline.',
          verdict: 'include',
        },
        closing_type: 'conclusion',
        needs_review: false,
        was_adjusted_by_ai: false,
        category: 'offline-preview',
        hook: text.split(/[.!?]/)[0]?.trim(),
        reason: 'Modo offline: corte sintético para validar pipeline sem chamada de API.',
      });

      pointer += 50;
    }

    return windows;
  }
}
