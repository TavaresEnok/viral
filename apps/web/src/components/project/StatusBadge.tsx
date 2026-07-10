import { cn } from '@/lib/cn';
import type { ProjectStatus } from '@/types/api.types';

const labels: Record<ProjectStatus, string> = {
  DRAFT: 'rascunho',
  PENDING: 'na fila',
  PROCESSING: 'processando',
  COMPLETED: 'pronto',
  FAILED: 'falhou',
};

const classes: Record<ProjectStatus, string> = {
  DRAFT: 'bg-black/55 text-ink-secondary backdrop-blur',
  PENDING: 'bg-black/55 text-ink-secondary backdrop-blur',
  PROCESSING: 'bg-accent text-[#10120A]',
  COMPLETED: 'bg-black/60 text-[color:var(--accent-text)] backdrop-blur',
  FAILED: 'bg-black/60 text-[#FF8A8A] backdrop-blur',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold lowercase', classes[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-pill bg-current', status === 'PROCESSING' && 'animate-pulse')} />
      {labels[status]}
    </span>
  );
}
