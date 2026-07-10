import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'info';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-white/5 text-ink-secondary border-white/10',
  success: 'bg-success/15 text-[color:var(--accent-text)] border-success/30',
  warning: 'bg-warning/15 text-yellow-200 border-warning/30',
  danger: 'bg-danger/15 text-red-200 border-danger/30',
  accent: 'bg-accent/15 text-[color:var(--accent-text)] border-accent/35',
  info: 'bg-info/15 text-blue-200 border-info/30',
};

export function Badge({ variant = 'default', className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', variants[variant], className)} {...props} />;
}
