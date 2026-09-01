import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      '{clipStyle} {language} {preferredDuration} {transcriptBlock} {contentProfile}',
    ),
  };
});

vi.mock('./content-profiles/index.js', () => ({
  loadContentProfile: vi.fn().mockResolvedValue(''),
}));

const mockTranscript = {
  segments: [
    { start: 0, end: 5, text: 'Olá mundo, este é um teste' },
    { start: 5, end: 10, text: 'Este é um conteúdo viral incrível' },
    { start: 10, end: 15, text: 'Nunca imaginei que isso funcionaria' },
  ],
  fullText: 'Olá mundo, este é um teste. Este é um conteúdo viral incrível. Nunca imaginei que isso funcionaria.',
  language: 'pt-BR',
  duration: 15,
};

describe('LlmClipAnalyzerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna [] e telemetria vazia quando transcript não tem segmentos', async () => {
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: { segments: [] },
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });
    expect(result.clips).toEqual([]);
    expect(result.telemetry.pass1Failed).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('retorna clips offline sem chamar o LLM quando offline=true', async () => {
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: { ...mockTranscript, duration: 120 },
      clipStyle: 'VIRAL',
      language: 'pt-BR',
      offline: true,
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(Array.isArray(result.clips)).toBe(true);
  });

  it('lança erro quando apiKey não configurada', async () => {
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({});
    await expect(
      svc.analyzeTranscript({
        transcript: mockTranscript,
        clipStyle: 'VIRAL',
        language: 'pt-BR',
      }),
    ).rejects.toThrow();
  });

  it('lança erro quando o provider falha em todas as janelas', async () => {
    // Provider fora do ar / modelo aposentado não pode virar fallback silencioso:
    // o chamador precisa ver a mensagem real para corrigir a configuração.
    mockCreate.mockRejectedValue(new Error('404 model no longer available'));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key', model: 'modelo-aposentado' });
    await expect(
      svc.analyzeTranscript({ transcript: mockTranscript, clipStyle: 'VIRAL', language: 'pt-BR' }),
    ).rejects.toThrow(/modelo-aposentado.*404 model no longer available/s);
  });

  it('retorna [] sem lançar quando resposta JSON é malformada', async () => {
    mockCreate.mockResolvedValue({
      usage: { total_tokens: 10 },
      choices: [{ message: { content: 'não é JSON válido }{' } }],
    });
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: mockTranscript,
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });
    expect(result.clips).toEqual([]);
    expect(result.telemetry.pass1Failed).toBe(false);
  });

  it('retorna [] quando resposta tem clips mas array está vazio', async () => {
    mockCreate.mockResolvedValue({
      usage: { total_tokens: 20 },
      choices: [{ message: { content: JSON.stringify({ clips: [] }) } }],
    });
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: mockTranscript,
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });
    expect(result.clips).toEqual([]);
    expect(result.telemetry.pass1Failed).toBe(false);
  });

  it('faz retry em erro 429 e lança após esgotar tentativas', async () => {
    mockCreate.mockRejectedValue(new Error('429 Too Many Requests rate limit exceeded'));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    await expect(
      svc.analyzeTranscript({ transcript: mockTranscript, clipStyle: 'VIRAL', language: 'pt-BR' }),
    ).rejects.toThrow(/429/);
    expect(mockCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
    // withRetry usa backoff exponencial real (2.5s + 5s + 10s = 17.5s com
    // maxAttempts=4/baseDelayMs=2500); o timeout padrão de 5s do vitest
    // estourava antes do teste terminar.
  }, 20_000);

  it('NÃO lança quando só parte das janelas falha (degrada com elegância)', async () => {
    // Transcrição longa o bastante para virar mais de uma janela.
    const segments = Array.from({ length: 300 }, (_, i) => ({
      start: i * 5,
      end: i * 5 + 5,
      text: `Segmento número ${i} com conteúdo suficiente para ocupar espaço no bloco.`,
    }));
    const longTranscript = {
      segments,
      fullText: segments.map((s) => s.text).join(' '),
      language: 'pt-BR',
      duration: 1500,
    };
    const ok = {
      usage: { total_tokens: 100 },
      choices: [
        {
          message: {
            content: JSON.stringify({
              clips: [
                {
                  start: 10,
                  end: 45,
                  title: 'Um corte plausível',
                  reason: 'trecho com gancho forte',
                  viral_score: 80,
                },
              ],
            }),
          },
        },
      ],
    };
    // Primeira janela falha, as demais respondem.
    mockCreate.mockRejectedValueOnce(new Error('503 upstream indisponível')).mockResolvedValue(ok);

    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: longTranscript,
      clipStyle: 'VIRAL',
      language: 'pt-BR',
      minViralScore: 0,
    });
    expect(mockCreate.mock.calls.length).toBeGreaterThan(1);
    expect(result.telemetry.pass1Failed).toBe(false);
  }, 30_000);
});
