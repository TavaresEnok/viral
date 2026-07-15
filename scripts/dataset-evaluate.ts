/**
 * Benchmark reproduzível de qualidade dos cortes.
 *
 * Golden dataset:
 *   corepack pnpm dataset:evaluate -- --dataset benchmarks/pt-br-golden.example.json \
 *     --predictions benchmarks/viralforge-predictions.example.json \
 *     --output benchmarks/results/viralforge.json
 *
 * Métricas operacionais históricas (modo legado, sem ground truth):
 *   corepack pnpm dataset:evaluate -- --database
 */

import { PrismaClient } from '../packages/database/src/index.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  evaluateBenchmark,
  type BenchmarkDataset,
  type BenchmarkPredictions,
  type BenchmarkReport,
} from '../packages/clip-analyzer/src/benchmark.js';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printReport(report: BenchmarkReport): void {
  console.log(`\n=== Benchmark: ${report.system} ===`);
  console.log(`Dataset: ${report.dataset}`);
  console.log(`Amostras cobertas: ${report.sampleCount - report.missingSampleIds.length}/${report.sampleCount} (${percent(report.coverage)})`);
  console.log(`Cortes humanos: ${report.referenceClipCount}`);
  console.log(`Cortes previstos: ${report.predictedClipCount}`);
  console.log('');
  console.log('IoU   Precisão   Recall   F1');
  for (const row of report.thresholds) {
    console.log(`${row.threshold.toFixed(1)}   ${percent(row.precision).padEnd(9)} ${percent(row.recall).padEnd(8)} ${percent(row.f1)}`);
  }
  console.log('');
  console.log(`IoU médio do melhor match: ${report.meanBestIoU.toFixed(3)}`);
  console.log(`Erro médio de borda: ${report.boundaryMaeSec === null ? 'N/A' : `${report.boundaryMaeSec.toFixed(2)}s`}`);
  console.log(`Erro médio de duração: ${report.durationMaeSec === null ? 'N/A' : `${report.durationMaeSec.toFixed(2)}s`}`);
  console.log(`NOTA: ${report.score.toFixed(2)}/100`);
  if (report.missingSampleIds.length) console.log(`Amostras sem predição: ${report.missingSampleIds.join(', ')}`);
}

async function readJson<T>(path: string): Promise<T> {
  const absolutePath = resolve(path);
  try {
    return JSON.parse(await readFile(absolutePath, 'utf8')) as T;
  } catch (error) {
    throw new Error(`Falha ao ler JSON ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runGoldenBenchmark(datasetPath: string, predictionPaths: string[]): Promise<void> {
  const dataset = await readJson<BenchmarkDataset>(datasetPath);
  const reports: BenchmarkReport[] = [];
  for (const predictionPath of predictionPaths) {
    const predictions = await readJson<BenchmarkPredictions>(predictionPath);
    const report = evaluateBenchmark(dataset, predictions);
    reports.push(report);
    printReport(report);
  }

  if (reports.length > 1) {
    console.log('\n=== Ranking ===');
    reports
      .sort((a, b) => b.score - a.score)
      .forEach((report, index) => console.log(`${index + 1}. ${report.system}: ${report.score.toFixed(2)}`));
  }

  const outputPath = argValue('--output');
  if (outputPath) {
    const absoluteOutput = resolve(outputPath);
    await mkdir(dirname(absoluteOutput), { recursive: true });
    await writeFile(absoluteOutput, `${JSON.stringify({ generatedAt: new Date().toISOString(), dataset: dataset.name, reports }, null, 2)}\n`, 'utf8');
    console.log(`\nRelatório salvo em ${absoluteOutput}`);
  }
}

async function runDatabaseSummary(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const projects = await prisma.project.findMany({
      where: { status: 'COMPLETED' },
      include: {
        clips: { include: { feedbacks: true } },
        pipelineMetrics: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const clips = projects.flatMap((project) => project.clips);
    const reviewed = clips.filter((clip) => clip.feedbacks.length > 0);
    const pipeline = projects.flatMap((project) => project.pipelineMetrics);
    const reasons = reviewed.flatMap((clip) => clip.feedbacks).reduce<Record<string, number>>((acc, feedback) => {
      acc[feedback.reason] = (acc[feedback.reason] ?? 0) + 1;
      return acc;
    }, {});

    console.log('=== Resumo operacional (não é benchmark de qualidade) ===');
    console.log(`Projetos: ${projects.length}`);
    console.log(`Clips: ${clips.length}`);
    console.log(`Clips com feedback explícito: ${reviewed.length}`);
    console.log(`Taxa de feedback: ${clips.length ? ((reviewed.length / clips.length) * 100).toFixed(1) : '0.0'}%`);
    console.log(`Viral score médio: ${clips.length ? (clips.reduce((sum, clip) => sum + clip.viralScore, 0) / clips.length).toFixed(1) : 'N/A'}`);
    console.log(`Final score médio: ${clips.length ? (clips.reduce((sum, clip) => sum + clip.finalScore, 0) / clips.length).toFixed(1) : 'N/A'}`);
    for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${reason}: ${count}`);
    if (pipeline.length) {
      console.log(`Tempo médio de pipeline: ${(pipeline.reduce((sum, metric) => sum + (metric.totalSec ?? 0), 0) / pipeline.length).toFixed(0)}s`);
      console.log(`Fallback usado: ${((pipeline.filter((metric) => metric.fallbackUsed).length / pipeline.length) * 100).toFixed(1)}%`);
    }
    console.log('\nAVISO: ausência de feedback não significa aprovação. Use --dataset e --predictions para medir qualidade.');
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const datasetPath = argValue('--dataset');
  const predictionArgs = process.argv.flatMap((arg, index) => arg === '--predictions' && process.argv[index + 1] ? [process.argv[index + 1]] : []);
  if (datasetPath) {
    if (!predictionArgs.length) throw new Error('Informe pelo menos um arquivo com --predictions');
    await runGoldenBenchmark(datasetPath, predictionArgs);
    return;
  }
  await runDatabaseSummary();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
