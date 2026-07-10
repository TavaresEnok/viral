'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Plus, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth.store';
import { Logo } from './Logo';
import { navItems, secondaryNavItems } from './Sidebar';

export function MobileNavDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.aside
                className="fixed inset-y-0 left-0 z-[91] flex w-[82vw] max-w-80 flex-col border-r border-hairline-subtle bg-base p-5 shadow-elevated outline-none md:hidden"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between">
                  <Logo />
                  <Dialog.Close className="rounded-pill p-2 text-ink-tertiary transition hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Fechar menu">
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>

                <Link href="/dashboard/new" className="mt-8" onClick={() => { capture('dashboard_new_project_clicked', { placement: 'mobile_drawer' }); onOpenChange(false); }}>
                  <Button className="w-full">
                    <Plus className="h-4 w-4" strokeWidth={2.4} />
                    Novo corte
                  </Button>
                </Link>

                <nav className="mt-8 space-y-1">
                  {navItems.map((item) => {
                    const active = item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          'flex h-[42px] items-center gap-3 rounded-input px-3 text-sm font-medium text-ink-secondary transition duration-150 ease-smooth hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          active && 'bg-elevated text-ink-primary',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn('h-2 w-2 rotate-45 rounded-[2px]', active ? 'bg-accent' : 'bg-hairline-strong')}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                  <div className="pt-3">
                    {[
                      ...secondaryNavItems,
                      ...(user?.isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          className="flex h-9 items-center gap-3 rounded-input px-3 text-[13px] text-ink-tertiary transition hover:bg-elevated hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                <div className="mt-auto border-t border-hairline-subtle pt-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-[linear-gradient(135deg,var(--special),var(--accent))] text-xs font-bold text-[#10120A]">
                      {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-primary">{user?.name}</p>
                      <p className="truncate text-xs text-ink-tertiary">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void api.auth.logout().catch(() => null);
                      logout();
                      onOpenChange(false);
                      router.replace('/login');
                    }}
                    className="mt-4 flex h-9 w-full items-center gap-2 rounded-pill px-2 text-sm text-ink-secondary transition hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
