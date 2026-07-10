'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Dropdown({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={8} className="z-[110] min-w-44 rounded-xl border border-hairline-subtle bg-surface p-1 shadow-elevated">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DropdownItem({ children, className, onSelect }: { children: ReactNode; className?: string; onSelect?: () => void }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className={cn('cursor-pointer rounded-lg px-3 py-2 text-sm text-ink-secondary outline-none transition hover:bg-elevated hover:text-ink-primary focus:bg-elevated focus:text-ink-primary', className)}>
      {children}
    </DropdownMenu.Item>
  );
}
