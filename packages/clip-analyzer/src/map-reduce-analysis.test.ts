/**
 * Testes da análise em janelas (map-reduce) e das guardas de custo.
 *
 * Vídeos longos antes eram AMOSTRADOS: trechos inteiros da transcrição nunca
 * chegavam ao modelo. Estes testes fixam o novo comportamento — a transcrição
 * inteira é coberta em janelas e os candidatos são consolidados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    readFile: vi.fn().mockResolvedValue(
      '{clipStyle} {language} {preferredDuration} {maxClips} {transcriptBlock} {contentProfile}',
    ),
  };
});

vi.mock('./content-profiles/index.js', () => ({
  loadContentProfile: vi.fn().mockResolvedValue(''),
}));

/** Transcrição sintética com `count` segmentos de 5s cada. */
function buildTranscript(count: number) {
  const segments = Array.from({ length: count }, (_, i) => ({
    start: i * 5,
    end: i * 5 + 5,
    text: `Segmento numero ${i} com texto suficiente para parecer fala real de um podcast`,
  }));
  return {
    segments,
    fullText: segments.map((s) => s.text).join(' '),
    language: 'pt-BR',
    duration: count * 5,
  };
}

/** Resposta válida do modelo com um corte dentro da janela informada. */
function clipResponse(start: number, viralScore: number) {
  return {
    usage: { total_tokens: 100 },
    choices: [
      {
        message: {
          content: JSON.stringify({
            clips: [
              {
                title: `Corte gerado em ${start}s`,
                start,
                end: start + 40,
                duration: 40,
                viral_score: viralScore,
                category: 'insight',
                reason: 'Momento com gancho forte e conclusão clara para teste.',
              },
            ],
          }),
        },
      },
    ],
  };
}

describe('análise em janelas (map-reduce)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_MAP_REDUCE;
    delete process.env.LLM_MAX_COST_USD;
  });

  afterEach(() => {
    vi.resetModules();
    delete process.env.LLM_MAP_REDUCE;
    delete process.env.LLM_MAX_COST_USD;
  });

  it('usa uma única chamada quando a transcrição cabe em uma janela', async () => {
    mockCreate.mockResolvedValue(clipResponse(0, 80));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    await svc.analyzeTranscript({
      transcript: buildTranscript(50),
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('divide em várias chamadas quando a transcrição é longa demais', async () => {
    mockCreate.mockResolvedValue(clipResponse(0, 80));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    // 1200 segmentos > MAX_SEGMENTS (420): precisa de mais de uma janela.
    await svc.analyzeTranscript({
      transcript: buildTranscript(1200),
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });

    expect(mockCreate.mock.calls.length).toBeGreaterThan(1);
  });

  it('cobre o fim da transcrição — o trecho final chega ao modelo', async () => {
    mockCreate.mockResolvedValue(clipResponse(0, 80));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    await svc.analyzeTranscript({
      transcript: buildTranscript(1200),
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });

    // O último segmento (índice 1199) precisa aparecer em alguma das chamadas.
    const todoConteudo = mockCreate.mock.calls
      .map((call) => JSON.stringify(call[0]?.messages ?? []))
      .join('\n');
    expect(todoConteudo).toContain('Segmento numero 1199');
  });

  it('consolida candidatos duplicados vindos de janelas sobrepostas', async () => {
    // Toda janela devolve um corte no MESMO intervalo: deve sobrar apenas um.
    mockCreate.mockResolvedValue(clipResponse(100, 90));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    const result = await svc.analyzeTranscript({
      transcript: buildTranscript(1200),
      clipStyle: 'VIRAL',
      language: 'pt-BR',
      minViralScore: 0,
    });

    const janelas = mockCreate.mock.calls.length;
    expect(janelas).toBeGreaterThan(1);
    // Cada janela devolveu 1 candidato no mesmo intervalo; após a consolidação
    // deve restar exatamente 1 (pass1CandidateCount é medido pós-merge).
    expect(result.telemetry.pass1CandidateCount).toBe(1);
    const inicios = result.clips.map((clip) => clip.start);
    expect(new Set(inicios).size).toBe(inicios.length);
  });

  it('LLM_MAP_REDUCE=false volta ao comportamento de chamada única', async () => {
    process.env.LLM_MAP_REDUCE = 'false';
    mockCreate.mockResolvedValue(clipResponse(0, 80));
    vi.resetModules();
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    await svc.analyzeTranscript({
      transcript: buildTranscript(1200),
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('aceita clip sem os campos opcionais emotional_density/quotability', async () => {
    // Regressão: toNumber() devolvia null para campo ausente e o schema rejeita
    // null em `.optional()`. Modelos que omitiam esses campos tinham TODOS os
    // cortes descartados em silêncio, zerando a análise.
    mockCreate.mockResolvedValue(clipResponse(0, 85));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    const result = await svc.analyzeTranscript({
      transcript: buildTranscript(50),
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });

    expect(result.telemetry.pass1CandidateCount).toBe(1);
  });

  it('aborta antes de gastar quando o custo projetado passa do teto', async () => {
    process.env.LLM_MAX_COST_USD = '0.0000001';
    vi.resetModules();
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });

    await expect(
      svc.analyzeTranscript({
        transcript: buildTranscript(600),
        clipStyle: 'VIRAL',
        language: 'pt-BR',
      }),
    ).rejects.toThrow(/excede o teto/i);

    // O ponto principal: nenhuma chamada paga foi feita.
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('aceita maxCostUsd passado diretamente pelas opções do construtor', async () => {
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key', maxCostUsd: 0.0000001 });

    await expect(
      svc.analyzeTranscript({
        transcript: buildTranscript(600),
        clipStyle: 'VIRAL',
        language: 'pt-BR',
      }),
    ).rejects.toThrow(/excede o teto/i);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calcula preço correto para modelos da família Gemini', async () => {
    const { modelCostPer1k } = await import('./llm-clip-analyzer.service.js');
    expect(modelCostPer1k('gemini-2.5-flash')).toBe(0.00015);
    expect(modelCostPer1k('gemini-2.0-flash')).toBe(0.0001);
    expect(modelCostPer1k('gemini-1.5-flash')).toBe(0.000075);
    expect(modelCostPer1k('minimax/minimax-m3:free')).toBe(0);
  });
});
