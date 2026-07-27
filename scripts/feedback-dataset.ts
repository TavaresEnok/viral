/**
 * Fecha o ciclo de feedback: transforma o que os usuários realmente aprovaram
 * (ou rejeitaram) em um dataset de avaliação reproduzível.
 *
 * O sistema já coletava ClipFeedback e já tinha um benchmark com golden set
 * humano (`samples/evaluation`, `pnpm dataset:evaluate`), mas as duas pontas
 * nunca se encontravam: o feedback de produção só virava texto no prompt e
 * nunca era usado para MEDIR se uma mudança de modelo melhora ou piora.
 *
 * Este script gera os dois arquivos que o benchmark consome:
 *   - dataset (ground truth): cortes que o usuário MANTEVE (sem rejeição)
 *   - predictions:            todos os cortes que a IA propôs
 *
 * Comparando os dois, `dataset:evaluate` mede precisão/recall do modelo contra
 * a preferência real dos usuários.
 *
 * Uso:
 *   corepack pnpm feedback:dataset
 *   corepack pnpm feedback:dataset -- --min-clips 3 --out benchmarks/feedback
 *   corepack pnpm dataset:evaluate -- \
 *     --dataset benchmarks/feedback/dataset.json \
 *     --predictions benchmarks/feedback/predictions.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '../packages/database/src/index.js';
import type {
  BenchmarkDataset,
  BenchmarkPredictions,
} from '../packages/clip-analyzer/src/benchmark.js';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Projetos com menos cortes que isso não dizem muito sobre qualidade. */
const minClips = Number(argValue('--min-clips') ?? 2);
const outDir = argValue('--out') ?? 'benchmarks/feedback';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      status: 'COMPLETED',
      durationSeconds: { not: null },
      // Só projetos cujos cortes receberam algum julgamento humano — sem isso
      // "ausência de rejeição" não significa aprovação, só desinteresse.
      clips: { some: { feedbacks: { some: {} } } },
    },
    select: {
      id: true,
      durationSeconds: true,
      clips: {
        select: {
          id: true,
          start: true,
          end: true,
          finalScore: true,
          viralScore: true,
          feedbacks: { select: { reason: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const datasetSamples: BenchmarkDataset['samples'] = [];
  const predictionSamples: BenchmarkPredictions['samples'] = [];
  let approved = 0;
  let rejected = 0;

  for (const project of projects) {
    if (project.clips.length < minClips) continue;

    // Ground truth: o corte que o humano NÃO rejeitou, num projeto que ele
    // efetivamente revisou.
    const kept = project.clips.filter((clip) => clip.feedbacks.length === 0);
    rejected += project.clips.length - kept.length;
    approved += kept.length;

    // Projeto em que o usuário rejeitou tudo não tem referência positiva.
    if (!kept.length) continue;

    datasetSamples.push({
      id: project.id,
      durationSec: project.durationSeconds ?? 0,
      referenceClips: kept.map((clip) => ({
        start: clip.start,
        end: clip.end,
        relevance: (clip.finalScore || clip.viralScore || 0) / 100,
      })),
    });

    predictionSamples.push({
      id: project.id,
      predictedClips: project.clips.map((clip) => ({
        start: clip.start,
        end: clip.end,
        relevance: (clip.finalScore || clip.viralScore || 0) / 100,
      })),
    });
  }

  if (!datasetSamples.length) {
    console.error(
      'Nenhum projeto elegível encontrado. É preciso ter projetos COMPLETED cujos ' +
        'cortes receberam feedback dos usuários.',
    );
    process.exitCode = 1;
    return;
  }

  const dataset: BenchmarkDataset = {
    schemaVersion: 1,
    name: 'feedback-de-producao',
    samples: datasetSamples,
  };
  const predictions: BenchmarkPredictions = {
    schemaVersion: 1,
    system: 'viralforge',
    // Data injetada aqui é só metadado do relatório, não afeta a comparação.
    generatedAt: new Date().toISOString(),
    samples: predictionSamples,
  };

  const dir = resolve(process.cwd(), outDir);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'dataset.json'), JSON.stringify(dataset, null, 2));
  await writeFile(resolve(dir, 'predictions.json'), JSON.stringify(predictions, null, 2));

  console.log(`\n=== Dataset gerado a partir do feedback de produção ===`);
  console.log(`Projetos usados:   ${datasetSamples.length}`);
  console.log(`Cortes aprovados:  ${approved}`);
  console.log(`Cortes rejeitados: ${rejected}`);
  console.log(`Arquivos:          ${outDir}/dataset.json e ${outDir}/predictions.json`);
  console.log(`\nPara medir a qualidade do modelo atual:`);
  console.log(
    `  corepack pnpm dataset:evaluate -- --dataset ${outDir}/dataset.json ` +
      `--predictions ${outDir}/predictions.json\n`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
