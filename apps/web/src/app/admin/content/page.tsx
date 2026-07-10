'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-success/15 text-success',
  FAILED: 'bg-danger/15 text-danger',
  PROCESSING: 'bg-info/15 text-info',
  PENDING: 'bg-elevated text-ink-tertiary',
  DRAFT: 'bg-elevated text-ink-tertiary',
};

const FILTERS = ['', 'COMPLETED', 'PROCESSING', 'FAILED'];

export default function AdminContentPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-content', page, status],
    queryFn: () => api.admin.content(page, status),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Edições</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Conteúdo</h1>
        <p className="mt-2 text-sm text-ink-secondary">{data ? `${data.total} vídeos de todos os usuários` : 'Carregando...'}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={cn(
              'rounded-pill border px-3.5 py-1.5 text-xs font-medium transition',
              status === value
                ? 'border-accent bg-[color:var(--accent-glow)] text-[color:var(--accent-text)]'
                : 'border-hairline-subtle text-ink-tertiary hover:text-ink-secondary',
            )}
          >
            {value === '' ? 'Todos' : value}
            {data?.byStatus[value] != null && value !== '' ? ` (${data.byStatus[value]})` : ''}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-[520px] rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-subtle text-left text-xs uppercase tracking-[0.1em] text-ink-tertiary">
                  <th className="px-5 py-3 font-medium">Vídeo</th>
                  <th className="px-5 py-3 font-medium">Dono</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Duração</th>
                  <th className="px-5 py-3 text-right font-medium">Cortes</th>
                  <th className="px-5 py-3 font-medium">Criado</th>
                </tr>
              </thead>
              <tbody>
                {data?.projects.map((project) => (
                  <tr key={project.id} className="border-b border-hairline-subtle/60 last:border-0 hover:bg-elevated/40">
                    <td className="max-w-[260px] truncate px-5 py-3.5 font-medium text-ink-primary">{project.title}</td>
                    <td className="px-5 py-3.5 text-xs text-ink-tertiary">{project.ownerEmail}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('inline-flex rounded-pill px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[project.status] ?? 'bg-elevated text-ink-tertiary')}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-secondary">{project.durationMinutes != null ? `${project.durationMinutes} min` : '—'}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-primary">{project.clips}</td>
                    <td className="px-5 py-3.5 text-ink-tertiary">{timeAgo(project.createdAt)}</td>
                  </tr>
                ))}
                {data && data.projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-ink-tertiary">Nenhum vídeo encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
