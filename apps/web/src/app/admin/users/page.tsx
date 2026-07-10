'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { UserActionsMenu } from '@/components/admin/UserActionsMenu';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

function PlanBadge({ plan }: { plan: string }) {
  const accent = plan !== 'free' && plan !== 'inactive';
  return (
    <span className={cn('inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold capitalize', accent ? 'bg-[color:var(--accent-glow)] text-[color:var(--accent-text)]' : 'bg-elevated text-ink-tertiary')}>
      {plan}
    </span>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Semeia a busca a partir do ?q= da URL (busca global vinda do sidebar).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => api.admin.users(page, search),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Gerenciamento</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Usuários</h1>
          <p className="mt-2 text-sm text-ink-secondary">{data ? `${data.total} usuários` : 'Carregando...'}</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Buscar por nome ou e-mail..."
            className="h-10 w-full rounded-pill border border-hairline-subtle bg-surface pl-10 pr-4 text-sm text-ink-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </div>
      </header>

      {isLoading && !data ? (
        <Skeleton className="h-[520px] rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-subtle text-left text-xs uppercase tracking-[0.1em] text-ink-tertiary">
                  <th className="px-5 py-3 font-medium">Usuário</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Assinatura</th>
                  <th className="px-5 py-3 text-right font-medium">Vídeos</th>
                  <th className="px-5 py-3 text-right font-medium">Cortes</th>
                  <th className="px-5 py-3 font-medium">Cadastro</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <tr key={user.id} className={cn('border-b border-hairline-subtle/60 last:border-0 hover:bg-elevated/40', user.suspended && 'opacity-60')}>
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/users/${user.id}`} className="group">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-primary group-hover:text-[color:var(--accent-text)]">{user.name}</span>
                          {user.isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--accent-text)]" />}
                          {user.suspended && <span className="rounded-pill bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-danger">suspenso</span>}
                          {!user.emailVerified && <span className="rounded-pill bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">não verif.</span>}
                        </div>
                        <p className="text-xs text-ink-tertiary">{user.email}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5"><PlanBadge plan={user.plan} /></td>
                    <td className="px-5 py-3.5 text-ink-secondary">{user.subscriptionStatus}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-primary">{user.projects}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-primary">{user.clips}</td>
                    <td className="px-5 py-3.5 text-ink-tertiary">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-3.5 text-right">
                      <UserActionsMenu user={user} onChanged={refresh} />
                    </td>
                  </tr>
                ))}
                {data && data.users.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-tertiary">Nenhum usuário encontrado.</td></tr>
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
