'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  Film,
  HardDrive,
  Loader2,
  Scissors,
  Sparkles,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { GrowthChart } from '@/components/admin/GrowthChart';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';

function LiveStat({
  label,
  value,
  icon: Icon,
  href,
  tone = 'normal',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href: string;
  tone?: 'normal' | 'warning' | 'danger' | 'accent';
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'accent'
          ? 'text-[color:var(--accent-text)]'
          : 'text-ink-primary';
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-hairline-subtle bg-surface p-4 shadow-elevated transition hover:border-accent/40"
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline-subtle bg-overlay', toneCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={cn('truncate text-xl font-semibold tracking-tight', toneCls)}>{value}</p>
        <p className="truncate text-xs text-ink-secondary">{label}</p>
      </div>
    </Link>
  );
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-hairline-subtle bg-surface p-5 shadow-elevated">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline-subtle bg-overlay text-accent">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-ink-primary">{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{label}</p>
      <p className="mt-3 text-xs text-ink-tertiary">{detail}</p>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = Math.max(1, rows.reduce((sum, [, count]) => sum + count, 0));
  return (
    <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">{title}</h2>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-ink-tertiary">Sem dados ainda.</p>}
        {rows.map(([label, count]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-ink-secondary">{label}</span>
              <span className="font-mono font-semibold text-ink-primary">{count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-elevated">
              <div className="h-full rounded-pill bg-progress-viral" style={{ width: `${Math.round((count / total) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: api.admin.overview,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const growth = useQuery({
    queryKey: ['admin-growth'],
    queryFn: api.admin.growth,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Estado operacional ao vivo — atualiza sozinho, dá o pulso da plataforma.
  const queue = useQuery({
    queryKey: ['admin-queue'],
    queryFn: api.admin.queue,
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });
  const stuck = useQuery({
    queryKey: ['admin-stuck'],
    queryFn: () => api.admin.stuck(30),
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
  const aiConfig = useQuery({
    queryKey: ['admin-ai-config'],
    queryFn: api.admin.aiConfig,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const topUsers = useQuery({
    queryKey: ['admin-top-users'],
    queryFn: () => api.admin.topUsers(8),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isError) {
    return (
      <div className="rounded-2xl border border-hairline-subtle bg-surface p-8 text-center text-sm text-ink-secondary">
        Indisponível. Esta área é restrita a administradores.
      </div>
    );
  }
  if (isLoading || !data) return <Skeleton className="h-[640px] rounded-2xl" />;

  const planRows = Object.entries(data.users.byPlan).sort((a, b) => b[1] - a[1]);
  const projectStatusRows = Object.entries(data.content.projectsByStatus).sort((a, b) => b[1] - a[1]);
  const clipStatusRows = Object.entries(data.content.clipsByStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-[1180px] space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Console administrativo</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Visão geral do negócio</h1>
        <p className="mt-2 text-sm text-ink-secondary">Métricas globais da plataforma — todos os usuários.</p>
      </header>

      {/* Faixa de comando — pulso operacional ao vivo. Atualiza sozinha. */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Operação ao vivo</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LiveStat
            label={aiConfig.data?.llmActive ? 'Modelo dos cortes (todos)' : 'IA por usuário — não centralizada'}
            value={aiConfig.data?.llmActive ? aiConfig.data.llmModel : 'configurar'}
            icon={Sparkles}
            href="/admin/ai"
            tone={aiConfig.data?.llmActive ? 'accent' : 'warning'}
          />
          <LiveStat
            label="Processando / na fila agora"
            value={`${queue.data?.counts.active ?? 0} / ${queue.data?.counts.waiting ?? 0}`}
            icon={Loader2}
            href="/admin/operations"
          />
          <LiveStat
            label="Jobs falhos na fila"
            value={queue.data?.counts.failed ?? 0}
            icon={XCircle}
            href="/admin/operations"
            tone={(queue.data?.counts.failed ?? 0) > 0 ? 'danger' : 'normal'}
          />
          <LiveStat
            label="Projetos travados (>30 min)"
            value={stuck.data?.projects.length ?? 0}
            icon={Clock}
            href="/admin/operations"
            tone={(stuck.data?.projects.length ?? 0) > 0 ? 'danger' : 'normal'}
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Usuários" value={data.users.total} detail={`${data.users.newLast7Days} novos em 7d · ${data.users.verified} verificados`} icon={Users} />
        <MetricCard label="MRR estimado" value={`$${data.revenue.mrr.toLocaleString('en-US')}`} detail={`${data.revenue.activeSubscriptions} assinaturas ativas`} icon={DollarSign} />
        <MetricCard label="Vídeos processados" value={data.content.projects} detail={`${data.content.totalMinutesIngested.toLocaleString('pt-BR')} min ingeridos`} icon={Film} />
        <MetricCard label="Cortes gerados" value={data.content.clips} detail={`${data.content.renderedClips} renderizados`} icon={Scissors} />
        <MetricCard label="Storage" value={data.storage.humanReadable ?? '—'} detail={data.storage.humanReadable ? data.storage.root : 'indisponível'} icon={HardDrive} />
        <MetricCard label="Falha do pipeline" value={`${data.pipeline.failureRate}%`} detail={`${data.pipeline.failed}/${data.pipeline.runs} execuções`} icon={Activity} />
      </div>

      {growth.data && growth.data.series.length > 0 && (
        <section className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Crescimento (30 dias)</h2>
            <p className="text-sm text-ink-secondary">
              <span className="font-mono font-bold text-[color:var(--accent-text)]">
                +{growth.data.series.reduce((sum, point) => sum + point.newUsers, 0)}
              </span>{' '}
              usuários no período
            </p>
          </div>
          <GrowthChart series={growth.data.series} />
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <BreakdownCard title="Usuários por plano" rows={planRows} />
        <BreakdownCard title="Projetos por status" rows={projectStatusRows} />
        <BreakdownCard title="Cortes por status" rows={clipStatusRows} />
      </section>

      <section className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Top usuários por cortes</h2>
          <Link href="/admin/users" className="text-xs font-medium text-[color:var(--accent-text)] hover:underline">Ver todos →</Link>
        </div>
        {topUsers.isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : !topUsers.data || topUsers.data.users.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Nenhum corte gerado ainda.</p>
        ) : (
          <div className="space-y-1">
            {topUsers.data.users.map((user, index) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-elevated/50"
              >
                <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-ink-tertiary">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-primary">{user.name || user.email}</p>
                  <p className="truncate text-xs text-ink-tertiary">{user.email} · {user.plan}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-semibold text-ink-primary">{user.clips.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-ink-tertiary">{user.projects} vídeos</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <div className="mb-5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Falhas recentes do pipeline</h2>
        </div>
        {data.pipeline.recentFailures.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Nenhuma falha recente.</p>
        ) : (
          <div className="space-y-2">
            {data.pipeline.recentFailures.map((failure) => (
              <div key={failure.id} className="flex items-center justify-between rounded-xl border border-hairline-subtle bg-base/40 px-4 py-3 text-sm">
                <span className="font-mono text-ink-secondary">{failure.projectId}</span>
                <span className="text-ink-primary">{failure.failedStage ?? 'desconhecido'}</span>
                <span className="text-ink-tertiary">{timeAgo(failure.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
