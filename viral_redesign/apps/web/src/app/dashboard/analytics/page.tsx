'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, MessageSquareWarning } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['quality-overview'], queryFn: api.quality.overview, staleTime: 30_000, refetchOnWindowFocus: false });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-1 py-2 md:px-4 md:py-6">
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    );
  }

  if (!data || data.totals.clips === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-1 py-2 md:px-4 md:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Dashboard</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink-primary md:text-5xl">Analytics</h1>
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-hairline-subtle bg-surface p-10 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-ink-primary">Nada para analisar ainda</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-secondary">
            Os primeiros clipes processados vão aparecer aqui com score, engajamento e métricas de desempenho.
          </p>
        </div>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="mx-auto max-w-[1400px] px-1 py-2 md:px-4 md:py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Dashboard</p>
      <h1 className="mt-3 text-4xl font-semibold text-ink-primary md:text-5xl">Analytics</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="Score médio" value={String(t.averageViralScore)} suffix="/100" />
        <KPI label="Projetos" value={String(t.completedProjects)} suffix={`/${t.projects}`} />
        <KPI label="Clips prontos" value={String(t.completedClips)} suffix={`/${t.clips}`} />
        <KPI label="Força abertura" value={String(t.averageOpeningStrength)} suffix="/100" />
      </div>

      <section className="mt-8 rounded-lg border border-hairline-subtle bg-surface p-6">
        <h2 className="mb-5 text-xl font-semibold text-ink-primary">Distribuição de score</h2>
        <div className="flex h-56 items-end gap-3 rounded-xl border border-hairline-subtle bg-base/35 p-4">
          {data.scoreBuckets.length ? (
            (() => {
              const maxBucket = Math.max(1, ...data.scoreBuckets.map((b) => b.count));
              return data.scoreBuckets.map((item) => {
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
              });
            })()
          ) : (
            <p className="w-full text-center text-sm text-ink-tertiary">Sem dados suficientes</p>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-hairline-subtle bg-surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline-subtle bg-overlay text-accent">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Qualidade</p>
              <p className="text-sm text-ink-primary">Força de abertura: {t.averageOpeningStrength}/100</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-hairline-subtle bg-surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline-subtle bg-overlay text-accent">
              <MessageSquareWarning className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-tertiary">Feedback</p>
              <p className="text-sm text-ink-primary">{t.clipBadRate}% de rejeição ({t.badFeedbacks} marcações)</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function KPI({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <section className="rounded-lg border border-hairline-subtle bg-surface p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-tertiary">{label}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-mono text-4xl font-light text-ink-primary">{value}</span>
        {suffix && <span className="font-mono text-sm text-ink-tertiary">{suffix}</span>}
      </div>
    </section>
  );
}
