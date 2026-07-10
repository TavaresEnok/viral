/**
 * Script de avaliação de qualidade dos cortes.
 * 
 * Como usar:
 *   corepack pnpm tsx scripts/dataset-evaluate.ts
 * 
 * Este script:
 * 1. Busca projetos COMPLETED do banco
 * 2. Para cada projeto, busca clips e feedbacks
 * 3. Calcula métricas de qualidade agregadas
 * 4. Gera relatório
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Dataset de Avaliação de Cortes ===\n');

  const projects = await prisma.project.findMany({
    where: { status: 'COMPLETED' },
    include: {
      clips: {
        include: { feedbacks: true },
      },
      pipelineMetrics: { take: 1, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  console.log(`Total de projetos avaliados: ${projects.length}\n`);

  let totalClips = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let sumViralScore = 0;
  let sumFinalScore = 0;
  const rejectionReasons: Record<string, number> = {};

  for (const project of projects) {
    const clips = project.clips;
    totalClips += clips.length;

    for (const clip of clips) {
      sumViralScore += clip.viralScore;
      sumFinalScore += clip.finalScore;

      for (const fb of clip.feedbacks) {
        totalRejected++;
        rejectionReasons[fb.reason] = (rejectionReasons[fb.reason] || 0) + 1;
      }
    }

    const approvedClips = clips.filter((c) => c.feedbacks.length === 0).length;
    totalApproved += approvedClips;
  }

  const avgViralScore = totalClips > 0 ? (sumViralScore / totalClips).toFixed(1) : 'N/A';
  const avgFinalScore = totalClips > 0 ? (sumFinalScore / totalClips).toFixed(1) : 'N/A';
  const approvalRate = totalClips > 0 ? ((totalApproved / totalClips) * 100).toFixed(1) : 'N/A';
  const rejectionRate = totalClips > 0 ? ((totalRejected / totalClips) * 100).toFixed(1) : 'N/A';

  console.log('=== Métricas Agregadas ===');
  console.log(`Total de clips: ${totalClips}`);
  console.log(`Clips aprovados (sem feedback): ${totalApproved}`);
  console.log(`Clips com feedback: ${totalRejected}`);
  console.log(`Taxa de aprovação: ${approvalRate}%`);
  console.log(`Taxa de rejeição: ${rejectionRate}%`);
  console.log(`Viral Score médio: ${avgViralScore}`);
  console.log(`Final Score médio: ${avgFinalScore}`);
  console.log('');

  if (Object.keys(rejectionReasons).length > 0) {
    console.log('=== Motivos de Rejeição ===');
    for (const [reason, count] of Object.entries(rejectionReasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${reason}: ${count} (${((count / totalRejected) * 100).toFixed(1)}%)`);
    }
    console.log('');
  }

  if (projects.length > 0) {
    const pipelineMetrics = projects.filter((p) => p.pipelineMetrics.length > 0);
    if (pipelineMetrics.length > 0) {
      console.log('=== Pipeline Metrics ===');
      const sumTotalSec = pipelineMetrics.reduce((acc, p) => acc + (p.pipelineMetrics[0].totalSec ?? 0), 0);
      const avgTotalSec = (sumTotalSec / pipelineMetrics.length).toFixed(0);
      const gpuCount = pipelineMetrics.filter((p) => p.pipelineMetrics[0].remoteGpuUsed).length;
      const fallbackCount = pipelineMetrics.filter((p) => p.pipelineMetrics[0].fallbackUsed).length;
      console.log(`Tempo médio de pipeline: ${avgTotalSec}s`);
      console.log(`Uso de GPU remota: ${((gpuCount / pipelineMetrics.length) * 100).toFixed(1)}%`);
      console.log(`Uso de fallback: ${((fallbackCount / pipelineMetrics.length) * 100).toFixed(1)}%`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
