'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, FolderKanban, KeyRound, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { capture } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { settle } from '@/lib/motion-variants';

const commands = [
  { id: 'projects', label: 'Meus projetos', hint: 'Abrir lista de projetos', href: '/dashboard', icon: FolderKanban },
  { id: 'new-project', label: 'Novo projeto', hint: 'Abrir criação em 3 etapas', href: '/dashboard?new=1', icon: Plus },
  { id: 'billing', label: 'Plano e cobrança', hint: 'Assinatura e uso', href: '/dashboard/billing', icon: BarChart3 },
  { id: 'settings', label: 'Configurações da conta', hint: 'Nome, e-mail e senha', href: '/dashboard/settings', icon: KeyRound },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(normalized));
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => {
          const next = !current;
          if (next) capture('command_palette_opened', { source: 'keyboard' });
          return next;
        });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runCommand(command: (typeof commands)[number]) {
    capture('command_palette_command_selected', { command: command.id });
    setOpen(false);
    setQuery('');
    router.push(command.href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={() => capture('command_palette_opened', { source: 'button' })}
          className="hidden h-9 w-full items-center justify-between gap-2 rounded-lg border border-hairline-subtle bg-surface px-3 text-xs text-ink-secondary transition hover:border-hairline-strong hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:flex"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            Buscar
          </span>
          <span className="rounded border border-hairline-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">Ctrl K</span>
        </button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                variants={settle}
                initial="initial"
                animate="animate"
                exit="exit"
                transformTemplate={(_, transform) => `translate(-50%, -50%) ${transform}`}
                className="fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated outline-none"
              >
                <div className="flex items-center gap-3 border-b border-hairline-subtle px-4 py-3">
                  <Search className="h-4 w-4 text-ink-tertiary" />
                  <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ir para..."
                    className="h-10 flex-1 bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-tertiary"
                  />
                  <Dialog.Close className="rounded-lg p-2 text-ink-tertiary transition hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Fechar command palette">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <div className="max-h-[360px] overflow-y-auto p-2">
                  {filtered.length ? filtered.map((command) => {
                    const Icon = command.icon;
                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => runCommand(command)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline-subtle bg-overlay text-accent">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink-primary">{command.label}</span>
                          <span className="block truncate text-xs text-ink-tertiary">{command.hint}</span>
                        </span>
                      </button>
                    );
                  }) : (
                    <div className="px-3 py-8 text-center text-sm text-ink-tertiary">Nenhum comando encontrado.</div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function CommandPaletteInlineButton({ className }: { className?: string }) {
  return <div className={cn(className)}><CommandPalette /></div>;
}
