'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, CreditCard, FolderKanban, Globe, KeyRound, LayoutTemplate, LogOut, Palette, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth.store';
import { Logo } from './Logo';

const navItems = [
  { href: '/dashboard', label: 'Projetos', icon: FolderKanban },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/billing', label: 'Cobrança', icon: CreditCard },
  { href: '/dashboard/brand', label: 'Brand kit', icon: Palette },
  { href: '/dashboard/settings', label: 'Integrações IA', icon: KeyRound },
  { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/dashboard/published', label: 'Publicações', icon: Globe },
  { href: '/dashboard/quality', label: 'Qualidade', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <aside className="hidden min-h-screen w-[220px] shrink-0 border-r border-hairline-subtle bg-surface/45 backdrop-blur-xl md:flex md:flex-col">
      <div className="flex h-14 items-center border-b border-hairline-subtle px-5">
        <Logo />
      </div>

      <div className="p-3">
        <Link href="/dashboard?new=1" onClick={() => capture('dashboard_new_project_clicked', { placement: 'sidebar' })}>
          <Button variant="secondary" className="w-full justify-start border-hairline-strong bg-elevated/70">
            <Plus className="h-4 w-4" />
            Novo projeto
          </Button>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex h-10 items-center gap-3 rounded-md px-3 text-sm transition duration-150 ease-defer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active ? 'bg-elevated text-ink-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]' : 'text-ink-secondary hover:bg-elevated/70 hover:text-ink-primary',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline-subtle p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-hairline-subtle bg-overlay text-xs font-semibold text-ink-primary">
            {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-primary">{user?.name}</p>
            <p className="truncate text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">Estúdio local</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void api.auth.logout().catch(() => null);
            logout();
            router.replace('/login');
          }}
          className="mt-2 flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-ink-secondary transition hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
