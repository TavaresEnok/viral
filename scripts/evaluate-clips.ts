import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LlmClipAnalyzerService, type ClipSuggestion, type TranscriptPayload } from '@viralforge/clip-analyzer';

interface ModelConfig {
  label: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

interface EvaluationClip {
  start: number;
  end: number;
  reason: string;
}

interface TestCase {
  name: string;
  transcript: TranscriptPayload;
  expectedClips: EvaluationClip[];
}

interface ModelResults {
  label: string;
  totalPrecision: number;
  totalRecall: number;
  totalMetric: number;
  totalCost: number;
  caseResults: Array<{ name: string; precision: number; recall: number; clips: number; cost: number }>;
}

function overlap(a: { start: number; end: number }, b: { start: number; end: number }): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function iou(a: { start: number; end: number }, b: { start: number; end: number }): number {
  const inter = overlap(a, b);
  const union = Math.max(a.end - a.start, b.end - b.start);
  return union > 0 ? inter / union : 0;
}

function precisionAtK(
  generated: ClipSuggestion[],
  expected: EvaluationClip[],
  k: number,
): { precision: number; recall: number; matches: number } {
  const topK = generated.slice(0, k);
  let matches = 0;
  const matchedExpected = new Set<number>();

  for (const gen of topK) {
    for (let i = 0; i < expected.length; i++) {
      if (matchedExpected.has(i)) continue;
      if (iou({ start: gen.start, end: gen.end }, { start: expected[i].start, end: expected[i].end }) >= 0.5) {
        matches++;
        matchedExpected.add(i);
        break;
      }
    }
  }

  return {
    precision: k > 0 ? matches / k : 0,
    recall: expected.length > 0 ? matches / expected.length : 0,
    matches,
  };
}

function parseDuration(duration: number, preferred: number): number {
  return Math.max(15, Math.min(90, duration || preferred));
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'deepseek-chat': { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 },
    'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
    'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    'claude-3-haiku': { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
    'gemini-2.0-flash': { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  };
  const p = pricing[model];
  if (!p) return 0;
  return inputTokens * p.input + outputTokens * p.output;
}

function parseModelConfigs(): ModelConfig[] {
  const configs: ModelConfig[] = [];

  configs.push({
    label: `DeepSeek (${process.env.DEEPSEEK_MODEL || 'deepseek-chat'})`,
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  });

  if (process.env.ALT_API_KEY) {
    configs.push({
      label: `Alternativo (${process.env.ALT_MODEL || 'gpt-4o-mini'})`,
      apiKey: process.env.ALT_API_KEY,
      baseURL: process.env.ALT_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.ALT_MODEL || 'gpt-4o-mini',
    });
  }

  if (configs.length === 1) {
    console.log('Apenas um modelo configurado. Defina ALT_API_KEY e ALT_MODEL para comparação.');
  }

  return configs;
}

async function runTestCase(
  analyzer: LlmClipAnalyzerService,
  testCase: TestCase,
): Promise<Awaited<ReturnType<LlmClipAnalyzerService['analyzeTranscript']>>> {
  const duration = testCase.transcript.duration || 600;
  const preferredDuration = parseDuration(duration, 45);

  return analyzer.analyzeTranscript({
    transcript: testCase.transcript,
    clipStyle: 'VIRAL',
    language: 'pt',
    preferredDuration,
    maxClips: 5,
    minViralScore: 0,
    offline: false,
  });
}

function printComparison(results: ModelResults[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('COMPARAÇÃO ENTRE MODELOS');
  console.log('='.repeat(80));

  const header = `  ${'Modelo'.padEnd(35)}  ${'Precision'.padEnd(10)}  ${'Recall'.padEnd(10)}  ${'Clips'.padEnd(6)}  ${'Custo'.padEnd(10)}`;
  console.log(header);
  console.log('  ' + '-'.repeat(75));

  for (const r of results) {
    const cases = r.caseResults.length;
    const avgPrecision = cases > 0 ? (r.totalPrecision / cases * 100).toFixed(1) : '-';
    const avgRecall = cases > 0 ? (r.totalRecall / cases * 100).toFixed(1) : '-';
    const totalClips = r.caseResults.reduce((s, c) => s + c.clips, 0);
    const totalCost = r.totalCost;
    console.log(
      `  ${r.label.padEnd(35)}  ${`${avgPrecision}%`.padEnd(10)}  ${`${avgRecall}%`.padEnd(10)}  ${`${totalClips}`.padEnd(6)}  ${`$${totalCost.toFixed(4)}`.padEnd(10)}`,
    );
  }

  if (results.length >= 2) {
    const best = results.reduce((a, b) => (a.totalPrecision > b.totalPrecision ? a : b));
    const cheapest = results.reduce((a, b) => (a.totalCost < b.totalCost ? a : b));
    console.log('\n  Melhor precision:', best.label);
    console.log('  Mais barato:', cheapest.label);

    if (best.label === cheapest.label) {
      console.log('  ★ Modelo recomendado:', best.label);
    } else {
      const costRatio = cheapest.totalCost > 0 ? (best.totalCost / cheapest.totalCost).toFixed(1) : '?';
      console.log(`  ★ Custo do melhor: ${costRatio}x o mais barato`);
    }
  }
}

async function evaluate() {
  const evalDir = resolve(import.meta.dirname, '..', 'samples', 'evaluation');
  const files = (await readdir(evalDir)).filter((f) => f.endsWith('.json'));

  if (!files.length) {
    console.log('Nenhum arquivo de avaliação encontrado em samples/evaluation/.');
    process.exit(1);
  }

  const testCases: TestCase[] = await Promise.all(
    files.map(async (file) => {
      const content = JSON.parse(await readFile(resolve(evalDir, file), 'utf8'));
      return content as TestCase;
    }),
  );

  console.log(`Dataset: ${testCases.length} caso(s)`);
  for (const tc of testCases) {
    console.log(`  • ${tc.name}: ${tc.transcript.segments.length} segmentos, ${tc.expectedClips.length} clips esperados`);
  }

  const modelConfigs = parseModelConfigs();
  const allResults: ModelResults[] = [];

  for (const cfg of modelConfigs) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Modelo: ${cfg.label}`);
    console.log(`  ${cfg.model} @ ${cfg.baseURL}`);
    console.log('='.repeat(80));

    const analyzer = new LlmClipAnalyzerService({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
      model: cfg.model,
      logger: (msg) => console.log(`  [${cfg.label}] ${msg}`),
    });

    const caseResults: ModelResults['caseResults'] = [];
    let totalPrecision = 0;
    let totalRecall = 0;
    let totalCost = 0;

    for (const testCase of testCases) {
      console.log(`\n  --- ${testCase.name} ---`);
      const result = await runTestCase(analyzer, testCase);
      const { clips, telemetry } = result;

      console.log(`  Clips: ${clips.length}`);
      const tokens = (telemetry?.tokensUsed || 0);
      const cost = estimateCost(cfg.model, tokens * 0.6, tokens * 0.4);
      totalCost += cost;
      console.log(`  Tokens: ${tokens}, Custo estimado: $${cost.toFixed(6)}`);

      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        console.log(`  [${i + 1}] ${c.start.toFixed(1)}s-${c.end.toFixed(1)}s (score=${c.viral_score}) "${c.hook?.slice(0, 60) ?? 'N/A'}"`);
      }

      const k = Math.min(5, Math.max(testCase.expectedClips.length, clips.length));
      const metrics = precisionAtK(clips, testCase.expectedClips, k);
      totalPrecision += metrics.precision;
      totalRecall += metrics.recall;

      console.log(`  Precision@${k}: ${(metrics.precision * 100).toFixed(1)}% | Recall: ${(metrics.recall * 100).toFixed(1)}% | Matches: ${metrics.matches}/${testCase.expectedClips.length}`);

      caseResults.push({
        name: testCase.name,
        precision: metrics.precision,
        recall: metrics.recall,
        clips: clips.length,
        cost,
      });
    }

    allResults.push({
      label: cfg.label,
      totalPrecision,
      totalRecall,
      totalMetric: totalPrecision + totalRecall,
      totalCost,
      caseResults,
    });
  }

  printComparison(allResults);
}

evaluate().catch((error) => {
  console.error('Falha na avaliação:', error);
  process.exit(1);
});
