/**
 * Comparação de modelos de IA no golden set local.
 *
 * Roda o LlmClipAnalyzerService REAL (mesmo prompt/validações da produção)
 * contra as transcrições de samples/evaluation/*.json e mede precisão,
 * recall e F1 dos cortes previstos contra os cortes marcados por humanos
 * (expectedClips), usando o scorer de packages/clip-analyzer/src/benchmark.ts.
 *
 * Uso:
 *   corepack pnpm model:compare
 *     → testa o modelo ATIVO do /admin/ai (PlatformAiConfig no banco)
 *
 *   corepack pnpm model:compare -- --models gemini-2.0-flash,gemini-2.5-flash
 *     → compara vários modelos usando a chave/baseURL do /admin/ai
 *
 *   corepack pnpm model:compare -- --api-key K --base-url URL --models m1,m2
 *     → chave/endpoint explícitos (ex.: testar OpenRouter/DeepSeek)
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../packages/database/src/index.js';
import { decryptSecret } from '../packages/shared/src/index.js';
import { LlmClipAnalyzerService } from '../packages/clip-analyzer/src/index.js';
import {
  evaluateBenchmark,
  type BenchmarkDataset,
  type BenchmarkPredictions,
} from '../packages/clip-analyzer/src/benchmark.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES_DIR = resolve(ROOT, 'samples/evaluation');

interface EvaluationSample {
  name: string;
  transcript: {
    title?: string;
    language?: string;
    duration: number;
    segments: Array<{ id?: number; start: number; end: number; text: string }>;
  };
  expectedClips: Array<{ start: number; end: number; reason?: string }>;
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Carrega o .env da raiz sem sobrescrever variáveis já presentes no ambiente. */
async function loadRootEnv(): Promise<void> {
  try {
    const raw = await readFile(resolve(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // Sem .env: segue apenas com o ambiente do shell.
  }
}

async function resolveProvider(): Promise<{ apiKey: string; baseURL?: string; activeModel?: string }> {
  const cliKey = argValue('--api-key');
  const cliBase = argValue('--base-url');
  if (cliKey) {
    return { apiKey: cliKey, baseURL: cliBase };
  }

  const prisma = new PrismaClient();
  try {
    const platform = await prisma.platformAiConfig.findUnique({ where: { id: 'default' } });
    if (!platform?.llmActive || !platform.llmApiKeyEncrypted) {
      throw new Error(
        'PlatformAiConfig inativa ou sem chave. Configure em /admin/ai ou passe --api-key/--base-url.',
      );
    }
    const masterSecret = process.env.MASTER_SECRET ?? process.env.API_KEY_ENCRYPTION_SECRET;
    if (!masterSecret) throw new Error('MASTER_SECRET não configurada no ambiente/.env');
    const apiKey = decryptSecret(platform.llmApiKeyEncrypted, masterSecret);
    if (!apiKey) throw new Error('Falha ao descriptografar a chave do PlatformAiConfig');
    return {
      apiKey,
      baseURL: cliBase ?? platform.llmBaseUrl ?? undefined,
      activeModel: platform.llmModel ?? undefined,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function loadSamples(): Promise<EvaluationSample[]> {
  const files = (await readdir(SAMPLES_DIR)).filter((file) => file.endsWith('.json')).sort();
  const samples: EvaluationSample[] = [];
  for (const file of files) {
    const parsed = JSON.parse(await readFile(resolve(SAMPLES_DIR, file), 'utf8')) as EvaluationSample;
    parsed.name = parsed.name || basename(file, '.json');
    samples.push(parsed);
  }
  if (!samples.length) throw new Error(`Nenhuma amostra em ${SAMPLES_DIR}`);
  return samples;
}

function buildDataset(samples: EvaluationSample[]): BenchmarkDataset {
  return {
    schemaVersion: 1,
    name: 'samples/evaluation (golden humano)',
    samples: samples.map((sample) => ({
      id: sample.name,
      durationSec: sample.transcript.duration,
      referenceClips: sample.expectedClips.map(({ start, end }) => ({ start, end })),
    })),
  };
}

async function evaluateModel(
  model: string,
  provider: { apiKey: string; baseURL?: string },
  samples: EvaluationSample[],
  dataset: BenchmarkDataset,
) {
  const verbose = process.argv.includes('--verbose');
  const analyzer = new LlmClipAnalyzerService({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    model,
    logger: verbose ? (message) => console.log(`    ${message}`) : () => undefined,
  });

  const predictions: BenchmarkPredictions = { schemaVersion: 1, system: model, samples: [] };
  let totalClips = 0;
  let totalTokens = 0;
  let failures = 0;
  const startedAt = Date.now();

  for (const sample of samples) {
    try {
      const { clips, telemetry } = await analyzer.analyzeTranscript({
        transcript: sample.transcript,
        clipStyle: 'VIRAL',
        language: sample.transcript.language ?? 'pt',
        preferredDuration: 45,
        maxClips: Math.max(8, sample.expectedClips.length + 2),
        minViralScore: 0,
      });
      totalClips += clips.length;
      totalTokens += telemetry.totalTokens;
      predictions.samples.push({
        id: sample.name,
        predictedClips: clips.map((clip) => ({
          start: clip.start,
          end: Math.min(clip.end, sample.transcript.duration),
        })),
      });
      console.log(`  ${sample.name}: ${clips.length} corte(s) aprovados`);
    } catch (error) {
      failures += 1;
      predictions.samples.push({ id: sample.name, predictedClips: [] });
      console.log(`  ${sample.name}: FALHOU — ${(error as Error).message.slice(0, 120)}`);
    }
  }

  const report = evaluateBenchmark(dataset, predictions);
  return { model, report, totalClips, totalTokens, failures, elapsedSec: (Date.now() - startedAt) / 1000 };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  await loadRootEnv();
  const provider = await resolveProvider();
  const models = (argValue('--models') ?? provider.activeModel ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!models.length) {
    throw new Error('Nenhum modelo para testar. Passe --models ou ative um modelo em /admin/ai.');
  }

  const samples = await loadSamples();
  const dataset = buildDataset(samples);
  console.log(`Golden set: ${samples.length} amostra(s), ${dataset.samples.reduce((n, s) => n + s.referenceClips.length, 0)} cortes humanos.`);
  console.log(`Endpoint: ${provider.baseURL ?? '(padrão do provider)'}\n`);

  const results = [];
  for (const model of models) {
    console.log(`=== ${model} ===`);
    results.push(await evaluateModel(model, provider, samples, dataset));
    console.log('');
  }

  console.log('┌── RESUMO ──────────────────────────────────────────────────────');
  for (const result of results.sort((a, b) => {
    const f1 = (r: typeof a) => r.report.thresholds.find((t) => t.threshold === 0.5)?.f1 ?? 0;
    return f1(b) - f1(a);
  })) {
    const at50 = result.report.thresholds.find((t) => t.threshold === 0.5);
    const at30 = result.report.thresholds.find((t) => t.threshold === 0.3);
    console.log(
      `│ ${result.model}\n` +
        `│   F1@IoU0.5: ${percent(at50?.f1 ?? 0)}  (precisão ${percent(at50?.precision ?? 0)}, recall ${percent(at50?.recall ?? 0)})\n` +
        `│   F1@IoU0.3: ${percent(at30?.f1 ?? 0)}  |  cortes aprovados: ${result.totalClips}  |  falhas: ${result.failures}\n` +
        `│   tokens: ${result.totalTokens}  |  tempo: ${result.elapsedSec.toFixed(0)}s`,
    );
  }
  console.log('└────────────────────────────────────────────────────────────────');
  console.log('\nLeitura: F1@IoU0.3 é o indicador principal (sobreposição razoável com corte humano).');
  console.log('Modelo saudável para lançamento: F1@0.3 > 40% e zero falhas de formato.');
}

main().catch((error) => {
  console.error(`\nERRO: ${(error as Error).message}`);
  process.exit(1);
});
