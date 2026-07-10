'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { AdminAuditEntry } from '@/types/api.types';

const ACTION_LABELS: Record<string, string> = {
  'admin.user.set_admin': 'Alterou acesso admin',
  'admin.user.suspend': 'Suspendeu conta',
  'admin.user.unsuspend': 'Reativou conta',
  'admin.user.set_plan': 'Alterou plano',
  'admin.user.verify_email': 'Verificou e-mail',
  'admin.project.requeue': 'Reprocessou projeto',
  'admin.project.cancel': 'Cancelou projeto',
  'auth.login_suspended': 'Login bloqueado (suspenso)',
};

function describe(entry: AdminAuditEntry) {
  const meta = entry.metadata as Record<string, unknown> | null;
  if (entry.action === 'admin.user.set_plan' && meta?.plan) return `Alterou plano → ${meta.plan}`;
  if (entry.action === 'admin.user.set_admin') return meta?.value ? 'Concedeu admin' : 'Removeu admin';
  return ACTION_LABELS[entry.action] ?? entry.action;
}

export default function AdminAuditPage() {
  const [scope, setScope] = useState<'' | 'all'>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', page, scope],
    queryFn: () => api.admin.audit(page, scope),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Controle</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Auditoria</h1>
          <p className="mt-2 text-sm text-ink-secondary">{data ? `${data.total} eventos` : 'Carregando...'} — quem fez o quê.</p>
        </div>
        <div className="flex gap-2">
          {([['', 'Ações admin'], ['all', 'Tudo']] as const).map(([value, label]) => (
            <button
              key={value || 'admin'}
              type="button"
              onClick={() => { setScope(value); setPage(1); }}
              className={cn('rounded-pill border px-3.5 py-1.5 text-xs font-medium transition', scope === value ? 'border-accent bg-[color:var(--accent-glow)] text-[color:var(--accent-text)]' : 'border-hairline-subtle text-ink-tertiary hover:text-ink-secondary')}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {isLoading && !data ? (
        <Skeleton className="h-[520px] rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
          <div className="divide-y divide-hairline-subtle/60">
            {data?.entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-ink-primary">{describe(entry)}</span>
                  {entry.entityType && entry.entityId && (
                    <span className="ml-2 font-mono text-xs text-ink-tertiary">{entry.entityType}:{entry.entityId.slice(0, 10)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-tertiary">
                  <span>{entry.actorEmail ?? 'sistema'}</span>
                  {entry.ip && <span className="font-mono">{entry.ip}</span>}
                  <span>{timeAgo(entry.createdAt)}</span>
                </div>
              </div>
            ))}
            {data && data.entries.length === 0 && (
              <p className="px-5 py-10 text-center text-ink-tertiary">Nenhum evento registrado ainda.</p>
            )}
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-hairline-subtle px-5 py-3 text-sm">
              <span className="text-ink-tertiary">Página {data.page} de {data.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-input border border-hairline-subtle px-3 py-1.5 text-ink-secondary transition hover:bg-elevated disabled:opacity-40">Anterior</button>
                <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-input border border-hairline-subtle px-3 py-1.5 text-ink-secondary transition hover:bg-elevated disabled:opacity-40">Próxima</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
