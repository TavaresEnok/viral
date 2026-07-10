'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { UserActionsMenu } from '@/components/admin/UserActionsMenu';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-success/15 text-success',
  FAILED: 'bg-danger/15 text-danger',
  PROCESSING: 'bg-info/15 text-info',
};

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hairline-subtle bg-base/40 p-4">
      <p className="text-xs uppercase tracking-wider text-ink-tertiary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-primary">{value}</p>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-user-detail', id],
    queryFn: () => api.admin.userDetail(id),
    refetchOnWindowFocus: false,
  });

  if (isError) {
    return <div className="rounded-2xl border border-hairline-subtle bg-surface p-8 text-center text-sm text-ink-secondary">Usuário não encontrado.</div>;
  }
  if (isLoading || !data) return <Skeleton className="h-[560px] rounded-2xl" />;

  const { user } = data;
  const plan = (user.quota as { plan?: string } | null)?.plan ?? 'free';
  const subscriptionStatus = (user.quota as { subscriptionStatus?: string } | null)?.subscriptionStatus ?? 'inactive';

  return (
    <div className="mx-auto max-w-[1000px] space-y-7">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-ink-tertiary transition hover:text-ink-secondary">
        <ArrowLeft className="h-4 w-4" /> Voltar para usuários
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--special),var(--accent))] text-xl font-bold text-[#10120A]">
            {user.name?.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink-primary">{user.name}</h1>
              {user.isAdmin && <ShieldCheck className="h-4 w-4 text-[color:var(--accent-text)]" />}
              {user.suspended && <span className="rounded-pill bg-danger/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-danger">suspenso</span>}
              {!user.emailVerified && <span className="rounded-pill bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">não verif.</span>}
            </div>
            <p className="mt-0.5 text-sm text-ink-tertiary">{user.email}</p>
          </div>
        </div>
        <UserActionsMenu
          user={{ id: user.id, email: user.email, isAdmin: user.isAdmin, suspended: user.suspended, emailVerified: user.emailVerified, plan }}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin-user-detail', id] })}
          trigger={<button type="button" className="rounded-input border border-hairline-subtle px-4 py-2 text-sm font-medium text-ink-secondary transition hover:bg-elevated hover:text-ink-primary">Ações</button>}
        />
      </header>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Plano" value={plan} />
        <Fact label="Assinatura" value={subscriptionStatus} />
        <Fact label="Vídeos" value={user._count.projects} />
        <Fact label="Cortes (10 últ.)" value={data.recentClips} />
        <Fact label="Cadastro" value={new Date(user.createdAt).toLocaleDateString('pt-BR')} />
      </section>

      <section className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Projetos recentes</h2>
        {data.recentProjects.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Nenhum projeto ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.recentProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between rounded-xl border border-hairline-subtle bg-base/40 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-ink-primary">{project.title || project.id}</span>
                <span className={cn('mx-3 inline-flex shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[project.status] ?? 'bg-elevated text-ink-tertiary')}>{project.status}</span>
                <span className="shrink-0 font-mono text-ink-secondary">{project.clips} cortes</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
