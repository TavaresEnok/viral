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

  it('retorna [] e pass1Failed=true quando API lança erro não-retryable', async () => {
    mockCreate.mockRejectedValue(new Error('500 Internal Server Error'));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: mockTranscript,
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });
    expect(result.clips).toEqual([]);
    expect(result.telemetry.pass1Failed).toBe(true);
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

  it('faz retry em erro 429 e tem pass1Failed=true após esgotar tentativas', async () => {
    mockCreate.mockRejectedValue(new Error('429 Too Many Requests rate limit exceeded'));
    const { LlmClipAnalyzerService } = await import('./llm-clip-analyzer.service.js');
    const svc = new LlmClipAnalyzerService({ apiKey: 'test-key' });
    const result = await svc.analyzeTranscript({
      transcript: mockTranscript,
      clipStyle: 'VIRAL',
      language: 'pt-BR',
    });
    expect(mockCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.telemetry.pass1Failed).toBe(true);
  });
});
