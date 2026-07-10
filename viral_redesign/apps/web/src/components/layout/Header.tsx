'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Menu, Moon, Plus, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { CommandPalette } from '@/components/global/CommandPalette';
import { capture } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth.store';
import { Logo } from './Logo';
import { MobileNavDrawer } from './MobileNavDrawer';

export function Header() {
  const [navOpen, setNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const user = useAuthStore((state) => state.user);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline-subtle bg-base/82 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <Button aria-label="Abrir menu" variant="secondary" className="h-9 w-9 p-0" onClick={() => setNavOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        <Logo />
      </div>

      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <CommandPalette />
        <span className="hidden text-xs text-ink-tertiary xl:inline">Busque projetos, métricas e integrações</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline-subtle bg-surface text-ink-secondary hover:text-ink-primary transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link href="/dashboard/quality">
          <Button aria-label="Qualidade" variant="secondary" className="h-9 w-9 p-0 md:w-auto md:px-3">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden md:inline">Qualidade</span>
          </Button>
        </Link>
        <Link href="/dashboard/new" onClick={() => capture('dashboard_new_project_clicked', { placement: 'topbar' })}>
          <Button aria-label="Novo projeto" className="h-9 w-9 p-0 md:w-auto md:px-3">
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline">Novo projeto</span>
          </Button>
        </Link>
        <div className="ml-1 hidden h-8 items-center gap-2 rounded-full border border-hairline-subtle bg-surface px-2 md:flex">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-accent/15 text-[10px] font-semibold text-teal-200">
            {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
          </div>
          <span className="max-w-28 truncate text-xs text-ink-secondary">{user?.name ?? 'Usuário'}</span>
        </div>
      </div>
      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </header>
  );
}
