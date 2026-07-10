import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-accent">
        <svg viewBox="0 0 12 12" className="ml-0.5 h-3.5 w-3.5" aria-hidden="true">
          <path d="M2.4 1.2 L10.6 6 L2.4 10.8 Z" fill="#10120A" />
        </svg>
      </div>
      <span className="font-display text-[22px] font-extrabold lowercase leading-none tracking-tight text-ink-primary">
        viral<span className="text-[color:var(--accent-text)]">.</span>
      </span>
    </div>
  );
}
