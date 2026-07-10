import { PrismaClient } from '@viralforge/database';

const prisma = new PrismaClient();

type Metric = Awaited<ReturnType<typeof prisma.pipelineRunMetric.findMany>>[number];

function avg(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function pct(value: number | null) {
  return value === null ? '-' : `${(value * 100).toFixed(1)}%`;
}

function sec(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}s` : '-';
}

function num(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';
}

function summarizeTimings(metrics: Metric[]) {
  const keys = new Set<string>();
  for (const metric of metrics) {
    const timings = metric.stageTimings as Record<string, number> | null;
    if (!timings) continue;
    Object.keys(timings).forEach((key) => keys.add(key));
  }

  return [...keys].sort().map((key) => {
    const value = avg(metrics.map((metric) => (metric.stageTimings as Record<string, number> | null)?.[key]));
    return { key, value };
  });
}

function groupByStatus(metrics: Metric[]) {
  return metrics.reduce<Record<string, number>>((acc, metric) => {
    acc[metric.status] = (acc[metric.status] ?? 0) + 1;
    return acc;
  }, {});
}

function groupByFailure(metrics: Metric[]) {
  return metrics
    .filter((metric) => metric.status === 'FAILED')
    .reduce<Record<string, number>>((acc, metric) => {
      const key = metric.failedStage ?? 'UNKNOWN';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
}

async function main() {
  const limit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 30);
  const metrics = await prisma.pipelineRunMetric.findMany({
    orderBy: { createdAt: 'desc' },
    take: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30,
    include: { project: { select: { title: true, userId: true, status: true } } },
  }).catch((error: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'P2021') {
      console.log('Tabela PipelineRunMetric ainda não existe. Aplique a migration antes de gerar o baseline:');
      console.log('  corepack pnpm --filter @viralforge/database prisma migrate deploy --schema prisma/schema.prisma');
      return [] as Metric[];
    }
    throw error;
  });

  if (!metrics.length) {
    console.log('Nenhuma métrica de pipeline encontrada. Processe um projeto após aplicar a migration.');
    return;
  }

  const completed = metrics.filter((metric) => metric.status === 'COMPLETED');
  const failed = metrics.filter((metric) => metric.status === 'FAILED');
  const statusBreakdown = groupByStatus(metrics);
  const failureBreakdown = groupByFailure(metrics);

  console.log('\n# Baseline ViralForge - Pipeline');
  console.log(`Amostra: ${metrics.length} execuções mais recentes`);
  console.log(`Concluídas: ${completed.length}`);
  console.log(`Falhas: ${failed.length}`);
  console.log(`Taxa de falha: ${pct(metrics.length ? failed.length / metrics.length : null)}`);
  console.log(`Status: ${JSON.stringify(statusBreakdown)}`);

  if (Object.keys(failureBreakdown).length) {
    console.log(`Falhas por etapa: ${JSON.stringify(failureBreakdown)}`);
  }

  console.log('\n## Médias Gerais');
  console.log(`Tempo total: ${sec(avg(metrics.map((metric) => metric.totalSec)))}`);
  console.log(`Duração do vídeo: ${sec(avg(metrics.map((metric) => metric.videoDurationSec)))}`);
  console.log(`Tokens LLM: ${num(avg(metrics.map((metric) => metric.llmTotalTokens)))}`);
  console.log(`Custo LLM estimado: $${num(avg(metrics.map((metric) => metric.llmCostEstimate)))}`);
  console.log(`Candidatos Pass 1: ${num(avg(metrics.map((metric) => metric.pass1CandidateCount)))}`);
  console.log(`Aprovados Pass 2: ${num(avg(metrics.map((metric) => metric.approvedClipCount)))}`);
  console.log(`Rejection rate Pass 2: ${pct(avg(metrics.map((metric) => metric.rejectionRate)))}`);
  console.log(`Clips renderizados: ${num(avg(metrics.map((metric) => metric.renderedClipCount)))}`);
  console.log(`Clips falhos no render: ${num(avg(metrics.map((metric) => metric.failedRenderCount)))}`);
  console.log(`Uso GPU remota: ${pct(metrics.filter((metric) => metric.remoteGpuUsed).length / metrics.length)}`);
  console.log(`Fallback usado: ${pct(metrics.filter((metric) => metric.fallbackUsed).length / metrics.length)}`);

  console.log('\n## Tempo Médio Por Etapa');
  for (const item of summarizeTimings(metrics)) {
    console.log(`${item.key}: ${sec(item.value)}`);
  }

  console.log('\n## Últimas Execuções');
  for (const metric of metrics.slice(0, 10)) {
    console.log([
      metric.createdAt.toISOString(),
      metric.status.padEnd(10),
      sec(metric.totalSec).padStart(9),
      `clips=${metric.renderedClipCount ?? '-'}/${metric.validatedClipCount ?? '-'}`,
      `gpu=${metric.remoteGpuUsed ? 'yes' : 'no'}`,
      `stage=${metric.failedStage ?? '-'}`,
      `project=${metric.project.title}`,
    ].join(' | '));
  }
}

main()
  .catch((error) => {
    console.error('Falha ao gerar baseline:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
