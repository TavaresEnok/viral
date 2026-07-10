'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, MessageSquareWarning } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { StatusBadge } from '@/components/project/StatusBadge';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { formatDuration, timeAgo } from '@/lib/format';

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-2xl border border-hairline-subtle bg-surface p-5 shadow-elevated">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline-subtle bg-overlay text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">7d</span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-ink-primary">{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{label}</p>
      <p className="mt-3 text-xs text-ink-tertiary">{detail}</p>
    </div>
  );
}

export default function QualityPage() {
  const { data, isLoading } = useQuery({ queryKey: ['quality-overview'], queryFn: api.quality.overview, staleTime: 30_000, refetchOnWindowFocus: false });

  useEffect(() => {
    capture('quality_dashboard_viewed');
  }, []);

  if (isLoading || !data) {
    return <Skeleton className="h-[720px] rounded-2xl" />;
  }

  const maxBucket = Math.max(1, ...data.scoreBuckets.map((bucket) => bucket.count));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Observabilidade</p>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-ink-primary md:text-5xl">Qualidade</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary">
              Veja se o pipeline está entregando cortes confiáveis: conclusão de projetos, rejeições, distribuição de score e tempo de render.
            </p>
          </div>
          <div className="rounded-xl border border-hairline-subtle bg-base/45 px-4 py-3 text-sm text-ink-secondary">
            {data.totals.completedClips}/{data.totals.clips} clips prontos
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Projetos concluídos" value={`${data.totals.projectCompletionRate}%`} detail={`${data.totals.completedProjects}/${data.totals.projects} projetos`} icon={CheckCircle2} />
        <MetricCard label="Falha de projeto" value={`${data.totals.projectFailureRate}%`} detail="taxa operacional" icon={AlertTriangle} />
        <MetricCard label="Score médio" value={data.totals.averageViralScore} detail="calibração do modelo" icon={BarChart3} />
        <MetricCard label="Feedback ruim" value={`${data.totals.clipBadRate}%`} detail={`${data.totals.badFeedbacks} marcações`} icon={MessageSquareWarning} />
        <MetricCard label="Render médio" value={data.totals.averageRenderDurationMs ? `${Math.round(data.totals.averageRenderDurationMs / 1000)}s` : 'novo'} detail="tempo por clip" icon={Clock3} />
        <MetricCard label="Remotion" value={data.totals.remotionRenderedClips} detail="renders modernos" icon={BarChart3} />
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Distribuição</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-primary">Score dos cortes</h2>
            </div>
            <span className="font-mono text-xs text-ink-tertiary">{data.totals.clips} clips</span>
          </div>
          <div className="flex h-56 items-end gap-3 rounded-xl border border-hairline-subtle bg-base/35 p-4">
            {data.scoreBuckets.map((item) => {
              const height = Math.max(8, Math.round((item.count / maxBucket) * 100));
              return (
                <div key={item.bucket} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div className="rounded-t-md bg-accent/80 shadow-glow" style={{ height: `${height}%` }} />
                  <div className="text-center">
                    <p className="font-mono text-xs text-ink-primary">{item.count}</p>
                    <p className="mt-1 text-[10px] text-ink-tertiary">{item.bucket}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Feedback</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-primary">Motivos de rejeição</h2>
          <div className="mt-6 space-y-3">
            {data.badReasons.length ? (
              data.badReasons.map((item) => (
                <div key={item.reason} className="flex items-center justify-between rounded-xl border border-hairline-subtle bg-base/35 px-4 py-3 text-sm">
                  <span className="text-ink-secondary">{item.reason}</span>
                  <span className="font-mono text-ink-primary">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-hairline-subtle bg-base/35 p-5 text-sm text-ink-tertiary">Nenhum feedback ruim registrado.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Pipeline</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-primary">Tempo por etapa</h2>
            </div>
            <span className="font-mono text-xs text-ink-tertiary">{data.pipeline.runs} runs</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <PipelineStat label="Total" value={data.totals.averagePipelineTotalSec} />
            <PipelineStat label="Download" value={data.totals.averageDownloadSec} />
            <PipelineStat label="Legendas" value={data.totals.averageCaptionsSec} />
            <PipelineStat label="ASR" value={data.totals.averageAsrSec} />
            <PipelineStat label="IA" value={data.totals.averageLlmAnalyzeSec} />
            <PipelineStat label="Render" value={data.totals.averageRenderTotalSec} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <TableStat value={`${data.totals.remoteGpuUseRate}%`} label="uso GPU" />
            <TableStat value={`${data.totals.fallbackUseRate}%`} label="fallback" />
            <TableStat value={`${data.totals.averagePass2RejectionRate}%`} label="rejeição P2" />
          </div>
        </div>

        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Falhas</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-primary">Por etapa</h2>
          <div className="mt-6 space-y-3">
            {data.pipeline.failureByStage.length ? (
              data.pipeline.failureByStage.map((item) => (
                <div key={item.stage} className="flex items-center justify-between rounded-xl border border-hairline-subtle bg-base/35 px-4 py-3 text-sm">
                  <span className="text-ink-secondary">{item.stage}</span>
                  <span className="font-mono text-ink-primary">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-hairline-subtle bg-base/35 p-5 text-sm text-ink-tertiary">Nenhuma falha recente registrada.</p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
        <div className="border-b border-hairline-subtle p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Operação</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-primary">Últimos projetos</h2>
        </div>
        <div className="divide-y divide-hairline-subtle">
          {data.recentProjects.length ? (
            data.recentProjects.map((project) => (
              <Link key={project.id} href={`/dashboard/${project.id}`} className="grid gap-3 p-4 transition hover:bg-elevated md:grid-cols-[1fr_100px_100px_120px_120px]">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <StatusBadge status={project.status} />
                    <span className="text-xs text-ink-tertiary">{timeAgo(project.createdAt)}</span>
                  </div>
                  <p className="truncate text-sm font-medium text-ink-primary">{project.title}</p>
                  <p className="mt-1 text-xs text-ink-tertiary">{project.lastStage ?? 'sem etapa'} · {formatDuration(project.durationSeconds)}</p>
                </div>
                <TableStat value={`${project.completedClipCount}/${project.clipCount}`} label="clips" />
                <TableStat value={project.averageViralScore} label="score" />
                <TableStat value={project.averageClosingStrength} label="fechamento" />
                <TableStat value={project.averageRenderDurationMs ? `${Math.round(project.averageRenderDurationMs / 1000)}s` : 'novo'} label="render" />
              </Link>
            ))
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline-subtle bg-overlay text-accent">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-ink-primary">Ainda não há projetos para medir</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-ink-tertiary">
                Quando os primeiros vídeos forem processados, esta área mostra tempo por etapa, score médio e sinais de qualidade dos cortes.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TableStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-sm md:text-right">
      <p className="font-mono font-medium text-ink-primary">{value}</p>
      <p className="text-xs text-ink-tertiary">{label}</p>
    </div>
  );
}

function PipelineStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-hairline-subtle bg-base/35 p-4">
      <p className="text-xs text-ink-tertiary">{label}</p>
      <p className="mt-2 font-mono text-xl text-ink-primary">{value ? `${Math.round(value)}s` : '-'}</p>
    </div>
  );
}
