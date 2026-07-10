'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, DollarSign, Film, LogOut, ScrollText, Search, ServerCog, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth.store';

const items: Array<{ href: string; label: string; icon: LucideIcon; exact?: boolean }> = [
  { href: '/admin', label: 'Visão geral', icon: BarChart3, exact: true },
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/financial', label: 'Financeiro', icon: DollarSign },
  { href: '/admin/content', label: 'Conteúdo', icon: Film },
  { href: '/admin/ai', label: 'IA', icon: Sparkles },
  { href: '/admin/operations', label: 'Operação', icon: ServerCog },
  { href: '/admin/audit', label: 'Auditoria', icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [query, setQuery] = useState('');

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    router.push(`/admin/users?q=${encodeURIComponent(term)}`);
  }

  return (
    <aside className="hidden min-h-screen w-[248px] shrink-0 flex-col border-r border-hairline-subtle bg-surface md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--accent-glow)] text-[color:var(--accent-text)]">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-ink-primary">ViralForge</p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">Admin</p>
        </div>
      </div>

      <form onSubmit={onSearch} className="px-3 pb-1 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar usuário..."
            className="h-9 w-full rounded-input border border-hairline-subtle bg-base pl-9 pr-3 text-sm text-ink-primary outline-none transition placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </div>
      </form>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-[42px] items-center gap-3 rounded-input px-3 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active ? 'bg-elevated text-ink-primary' : 'text-ink-secondary hover:bg-elevated/60 hover:text-ink-primary',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-hairline-subtle p-3">
        <Link
          href="/dashboard"
          className="flex h-9 items-center gap-3 rounded-input px-3 text-[13px] text-ink-tertiary transition hover:bg-elevated/60 hover:text-ink-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          Voltar ao app
        </Link>
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-[linear-gradient(135deg,var(--special),var(--accent))] text-xs font-bold text-[#10120A]">
            {user?.name?.slice(0, 1).toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-primary">{user?.name}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">admin</p>
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
