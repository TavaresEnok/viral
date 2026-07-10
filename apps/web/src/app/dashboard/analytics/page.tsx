'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useProjects } from '@/hooks/useProjects';

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['quality-overview'], queryFn: api.quality.overview, staleTime: 30_000, refetchOnWindowFocus: false });
  const { data: projects = [] } = useProjects();

  const topClips = projects
    .flatMap((project) => (project.clips ?? []).map((clip) => ({ ...clip, projectTitle: project.title })))
    .map((clip) => ({ ...clip, score: clip.finalScore || clip.viralScore || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] px-1 py-2 md:px-4 md:py-4">
        <Skeleton className="h-[400px] rounded-card" />
      </div>
    );
  }

  if (!data || data.totals.clips === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-1 py-2 md:px-4 md:py-4">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">raio-x do canal</p>
        <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Desempenho</h1>
        <div className="mt-12 flex flex-col items-center justify-center rounded-card border border-hairline-subtle bg-surface p-10 text-center">
          <div className="mb-5 grid h-[52px] w-[52px] place-items-center rounded-pill bg-accent text-[#10120A]">
            <BarChart3 className="h-6 w-6" strokeWidth={2} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink-primary">Nada pra analisar ainda</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-secondary">
            Manda teu primeiro vídeo que os scores aparecem aqui.
          </p>
        </div>
      </div>
    );
  }

  const t = data.totals;
  const maxBucket = Math.max(1, ...data.scoreBuckets.map((bucket) => bucket.count));

  return (
    <div className="mx-auto max-w-[1280px] px-1 py-2 md:px-4 md:py-4">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">raio-x do canal</p>
      <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Desempenho</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPI label="score médio" value={String(t.averageFinalScore || t.averageViralScore)} suffix="/100" highlight />
        <KPI label="cortes gerados" value={String(t.clips)} />
        <KPI label="taxa de conclusão" value={String(Math.round(t.projectCompletionRate))} suffix="%" />
        <KPI label="rejeitados" value={String(t.badFeedbacks)} suffix={`· ${t.clipBadRate}%`} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-hairline-subtle bg-surface p-6">
          <h2 className="font-display text-base font-bold text-ink-primary">Distribuição de score viral</h2>
          <div className="mt-6 flex h-52 items-end gap-3">
            {data.scoreBuckets.length ? (
              data.scoreBuckets.map((item) => {
                const height = Math.max(6, Math.round((item.count / maxBucket) * 100));
                const isTop = item.bucket.startsWith('90');
                return (
                  <div key={item.bucket} className="flex h-full flex-1 flex-col justify-end">
                    <p className="mb-1.5 text-center font-mono text-xs font-bold text-ink-primary">{item.count}</p>
                    <div
                      className={cn('rounded-t-[6px]', isTop ? 'bg-accent' : 'bg-hairline-strong')}
                      style={{ height: `${height}%` }}
                    />
                    <p className="mt-2 text-center font-mono text-[10px] text-ink-tertiary">{item.bucket}</p>
                  </div>
                );
              })
            ) : (
              <p className="w-full text-center text-sm text-ink-tertiary">Sem dados suficientes</p>
            )}
          </div>
        </div>

        <div className="rounded-card border border-hairline-subtle bg-surface p-6">
          <h2 className="font-display text-base font-bold text-ink-primary">Top cortes do mês</h2>
          {topClips.length ? (
            <ol className="mt-4 space-y-3">
              {topClips.map((clip, index) => (
                <li key={clip.id} className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-ink-tertiary">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-primary">{clip.title}</p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-ink-tertiary">{clip.projectTitle}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-pill border border-hairline-subtle px-2 py-0.5 font-mono text-xs font-bold',
                      clip.score >= 90 ? 'text-[color:var(--accent-text)]' : 'text-ink-secondary',
                    )}
                  >
                    ▲ {clip.score}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-ink-tertiary">Ainda sem cortes pontuados.</p>
          )}
        </div>
      </section>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink-tertiary">
        O score viral (0–100) combina força do gancho, fechamento da ideia, independência de contexto e potencial de
        compartilhamento. Cortes 90+ são os que mais estouram.
      </p>
    </div>
  );
}

function KPI({ label, value, suffix, highlight }: { label: string; value: string; suffix?: string; highlight?: boolean }) {
  return (
    <section className="rounded-card border border-hairline-subtle bg-surface p-5">
      <p className="font-mono text-micro font-bold uppercase tracking-[0.12em] text-ink-tertiary">{label}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cn('font-display text-4xl font-extrabold', highlight ? 'text-[color:var(--accent-text)]' : 'text-ink-primary')}>
          {value}
        </span>
        {suffix && <span className="font-mono text-sm text-ink-tertiary">{suffix}</span>}
      </div>
    </section>
  );
}
