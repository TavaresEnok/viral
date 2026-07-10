'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-hairline-subtle bg-surface p-5 shadow-elevated">
      <p className="text-3xl font-semibold tracking-tight text-ink-primary">{value}</p>
      <p className="mt-1 text-sm text-ink-secondary">{label}</p>
      {sub && <p className="mt-2 text-xs text-ink-tertiary">{sub}</p>}
    </div>
  );
}

export default function AdminFinancialPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-financial'],
    queryFn: api.admin.financial,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) return <Skeleton className="h-[560px] rounded-2xl" />;

  const usd = (value: number) => `$${value.toLocaleString('en-US')}`;
  const planRows = Object.entries(data.mrrByPlan).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-[1180px] space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Financeiro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Receita</h1>
        <p className="mt-2 text-sm text-ink-secondary">Estimativa a partir das assinaturas ativas ({data.currency}).</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="MRR" value={usd(data.mrr)} sub="receita recorrente mensal" />
        <Stat label="ARR" value={usd(data.arr)} sub="projeção anual" />
        <Stat label="Assinaturas ativas" value={String(data.activeSubscriptions)} sub="planos pagos" />
        <Stat label="ARPU" value={usd(data.arpu)} sub="receita média por assinante" />
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">MRR por plano</h2>
          <div className="space-y-3">
            {planRows.length === 0 && <p className="text-sm text-ink-tertiary">Nenhuma assinatura paga ainda.</p>}
            {planRows.map(([plan, value]) => (
              <div key={plan} className="flex items-center justify-between rounded-xl border border-hairline-subtle bg-base/40 px-4 py-3">
                <span className="capitalize text-ink-secondary">
                  {plan} <span className="text-ink-tertiary">· ${data.planPrices[plan] ?? 0}/mês × {data.activeByPlan[plan] ?? 0}</span>
                </span>
                <span className="font-mono font-semibold text-ink-primary">{usd(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Assinaturas por status</h2>
          <div className="space-y-2">
            {Object.entries(data.subscriptionsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-ink-secondary">{status}</span>
                <span className="font-mono font-semibold text-ink-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Assinantes recentes</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Nenhum assinante com Stripe ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map((row, index) => (
              <div key={`${row.email}-${index}`} className="flex items-center justify-between rounded-xl border border-hairline-subtle bg-base/40 px-4 py-3 text-sm">
                <span className="text-ink-primary">{row.email}</span>
                <span className="capitalize text-ink-secondary">{row.plan} · {row.status}</span>
                <span className="text-ink-tertiary">{timeAgo(row.updatedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
