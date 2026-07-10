import { cn } from '@/lib/cn';
import type { ProjectStatus } from '@/types/api.types';

const labels: Record<ProjectStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Na fila',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};

const classes: Record<ProjectStatus, string> = {
  DRAFT: 'bg-white/5 text-ink-tertiary',
  PENDING: 'bg-info/15 text-blue-200',
  PROCESSING: 'bg-info/15 text-blue-200',
  COMPLETED: 'bg-success/15 text-emerald-200',
  FAILED: 'bg-danger/15 text-red-200',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium', classes[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', status === 'PROCESSING' && 'animate-pulse')} />
      {labels[status]}
    </span>
  );
}
