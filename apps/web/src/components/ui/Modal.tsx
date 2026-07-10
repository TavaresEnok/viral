'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { settle } from '@/lib/motion-variants';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, title, description, children, footer, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[100] bg-black/74 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                variants={settle}
                initial="initial"
                animate="animate"
                exit="exit"
                transformTemplate={(_, generatedTransform) => `translate(-50%, -50%) ${generatedTransform}`}
                className={cn(
                  'fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-1.25rem)] w-[calc(100vw-1.25rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated outline-none sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]',
                  className,
                )}
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline-subtle bg-surface/95 p-5 backdrop-blur">
                  <div>
                    <Dialog.Title className="text-xl font-semibold tracking-tight text-ink-primary">{title}</Dialog.Title>
                    {description && <Dialog.Description className="mt-1 text-sm text-ink-secondary">{description}</Dialog.Description>}
                  </div>
                  <Dialog.Close className="rounded-lg p-2 text-ink-tertiary transition hover:bg-elevated hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Fechar">
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
                {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-hairline-subtle bg-surface/95 p-5 backdrop-blur">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
