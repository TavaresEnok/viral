import { Film, X } from 'lucide-react';
import { formatBytes } from '@/lib/format';

export function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-hairline-subtle bg-elevated p-3">
      <Film className="h-5 w-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-ink-primary">{file.name}</p>
        <p className="text-xs text-ink-tertiary">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover arquivo"
        className="rounded-lg p-2 text-ink-tertiary hover:bg-overlay hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
