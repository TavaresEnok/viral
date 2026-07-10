'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { CommandPalette } from '@/components/global/CommandPalette';
import { capture } from '@/lib/analytics';
import { Logo } from './Logo';
import { MobileNavDrawer } from './MobileNavDrawer';

const titles: Array<[string, string]> = [
  ['/dashboard/analytics', 'Desempenho'],
  ['/dashboard/connections', 'Redes conectadas'],
  ['/dashboard/published', 'Postagens'],
  ['/dashboard/billing', 'Plano'],
  ['/dashboard/settings', 'Configurações'],
  ['/dashboard/quality', 'Qualidade'],
  ['/dashboard/admin', 'Admin'],
  ['/dashboard/new', 'Novo corte'],
  ['/dashboard', 'Estúdio'],
];

function screenTitle(pathname: string | null) {
  if (!pathname) return 'Estúdio';
  const match = titles.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : 'Estúdio';
}

export function Header() {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-hairline-subtle bg-base/85 px-4 backdrop-blur-xl md:px-7">
      <div className="flex items-center gap-3 md:hidden">
        <Button aria-label="Abrir menu" variant="secondary" size="sm" className="h-9 w-9 p-0" onClick={() => setNavOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        <Logo />
      </div>

      <h1 className="hidden font-display text-lg font-bold tracking-tight text-ink-primary md:block">
        {screenTitle(pathname)}
      </h1>

      <div className="flex items-center gap-2.5">
        <div className="hidden md:block">
          <CommandPalette />
        </div>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="flex h-9 items-center gap-2 rounded-pill border border-hairline-subtle bg-surface px-3.5 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink-primary"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-accent" />
          {theme === 'dark' ? 'light' : 'dark'}
        </button>
        <Link href="/dashboard/new" onClick={() => capture('dashboard_new_project_clicked', { placement: 'topbar' })}>
          <Button aria-label="Novo corte" size="sm" className="h-9 w-9 p-0 md:w-auto md:px-4">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            <span className="hidden md:inline">Novo corte</span>
          </Button>
        </Link>
      </div>
      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </header>
  );
}
