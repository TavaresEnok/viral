'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

const QUEUE_LABELS: Record<string, string> = {
  waiting: 'Na fila',
  active: 'Processando',
  delayed: 'Agendados',
  completed: 'Concluídos',
  failed: 'Falhos',
  paused: 'Pausados',
};

function QueueStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-hairline-subtle bg-surface p-5 shadow-elevated">
      <p className={danger && value > 0 ? 'text-3xl font-semibold text-danger' : 'text-3xl font-semibold text-ink-primary'}>{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{label}</p>
    </div>
  );
}

export default function AdminOperationsPage() {
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ['admin-queue'],
    queryFn: api.admin.queue,
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });

  const stuck = useQuery({
    queryKey: ['admin-stuck'],
    queryFn: () => api.admin.stuck(30),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const action = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; label: string }) => run(),
    onSuccess: (_r, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-stuck'] });
      queryClient.invalidateQueries({ queryKey: ['admin-queue'] });
      toast.success(variables.label);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Falha na ação'),
  });

  return (
    <div className="mx-auto max-w-[1180px] space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Controle</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Operação</h1>
        <p className="mt-2 text-sm text-ink-secondary">Fila de processamento e projetos travados. Atualiza automaticamente.</p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Fila de processamento</h2>
        {queue.isLoading || !queue.data ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {Object.entries(QUEUE_LABELS).map(([key, label]) => (
              <QueueStat key={key} label={label} value={queue.data.counts[key] ?? 0} danger={key === 'failed'} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
            Projetos travados {stuck.data ? `(> ${stuck.data.thresholdMinutes} min em processamento)` : ''}
          </h2>
        </div>
        {stuck.isLoading && !stuck.data ? (
          <Skeleton className="m-4 h-40 rounded-xl" />
        ) : stuck.data && stuck.data.projects.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-ink-tertiary">Nenhum projeto travado. Tudo fluindo.</p>
        ) : (
          <div className="divide-y divide-hairline-subtle/60 border-t border-hairline-subtle">
            {stuck.data?.projects.map((project) => (
              <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-primary">{project.title || project.id}</p>
                  <p className="text-xs text-ink-tertiary">{project.ownerEmail} · {project.progress}% · travado há {timeAgo(project.stuckSince)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => action.mutate({ label: 'Reprocessamento enfileirado', run: () => api.admin.requeueProject(project.id) })}
                    className="inline-flex items-center gap-1.5 rounded-input border border-hairline-subtle px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-elevated hover:text-ink-primary"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reprocessar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('Cancelar este projeto? Ele será marcado como falho.')) return;
                      action.mutate({ label: 'Projeto cancelado', run: () => api.admin.cancelProject(project.id) });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-input border border-hairline-subtle px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
