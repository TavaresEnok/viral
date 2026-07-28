'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Plus, Settings, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useQuota } from '@/hooks/useQuota';
import { useAuthStore } from '@/stores/auth.store';
import { Logo } from './Logo';

export const navItems = [
  { href: '/dashboard', label: 'Cortes' },
  { href: '/dashboard/quick-caption', label: 'Editor em massa' },
  { href: '/dashboard/import-channel', label: 'Importar canal' },
  { href: '/dashboard/analytics', label: 'Desempenho' },
  { href: '/dashboard/connections', label: 'Redes' },
  { href: '/dashboard/published', label: 'Postagens' },
  { href: '/dashboard/billing', label: 'Plano' },
];

export const secondaryNavItems = [
  { href: '/dashboard/settings', label: 'Conta', icon: Settings },
];

function formatPlan(plan?: string) {
  if (!plan) return 'Plano Free';
  const name = plan.toLowerCase();
  return `Plano ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: quota } = useQuota();

  const used = quota?.projectsUsed ?? 0;
  const limit = quota?.projectsLimit ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isFree = !quota || quota.plan?.toUpperCase() !== 'PRO';

  return (
    <aside className="hidden min-h-screen w-[248px] shrink-0 border-r border-hairline-subtle bg-surface md:flex md:flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" aria-label="Ir para o estúdio">
          <Logo />
        </Link>
      </div>

      <div className="px-4 pb-2 pt-1">
        <Link href="/dashboard/new" onClick={() => capture('dashboard_new_project_clicked', { placement: 'sidebar' })}>
          <Button className="w-full">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Novo corte
          </Button>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const active = item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex h-[42px] items-center gap-3 rounded-input px-3 text-sm font-medium transition duration-150 ease-defer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active ? 'bg-elevated text-ink-primary' : 'text-ink-secondary hover:bg-elevated/60 hover:text-ink-primary',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-2 w-2 rotate-45 rounded-[2px] transition duration-150',
                  active ? 'bg-accent' : 'bg-hairline-strong group-hover:bg-ink-tertiary',
                )}
              />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          {[
            ...secondaryNavItems,
            ...(user?.isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
          ].map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-input px-3 text-[13px] transition duration-150 ease-defer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active ? 'bg-elevated text-ink-primary' : 'text-ink-tertiary hover:bg-elevated/60 hover:text-ink-secondary',
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="space-y-3 border-t border-hairline-subtle p-4">
        <div className="rounded-card border border-hairline-subtle bg-elevated/50 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-micro uppercase tracking-[0.12em] text-ink-secondary">{formatPlan(quota?.plan)}</span>
            <span className="font-mono text-caption font-bold text-ink-primary">
              {used}/{limit > 0 ? limit : '—'}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-elevated">
            <div className="h-full rounded-pill bg-progress-viral" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-micro normal-case tracking-normal text-ink-tertiary">vídeos usados este mês</p>
          {isFree && (
            <Link href="/dashboard/billing" className="mt-3 block">
              <Button size="sm" className="w-full bg-ink-primary text-base hover:brightness-100 hover:opacity-90">
                Virar Pro
              </Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-[linear-gradient(135deg,var(--special),var(--accent))] text-xs font-bold text-[#10120A]">
            {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-primary">{user?.name}</p>
            <p className="truncate font-mono text-micro uppercase tracking-[0.12em] text-ink-tertiary">{isFree ? 'free' : 'pro'}</p>
          </div>
          <button
            type="button"
            aria-label="Sair"
            onClick={() => {
              void api.auth.logout().catch(() => null);
              logout();
              router.replace('/login');
            }}
            className="grid h-8 w-8 place-items-center rounded-pill text-ink-tertiary transition hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </aside>
  );
}
