export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline-strong bg-surface text-[11px] font-semibold tracking-[-0.04em] text-ink-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        IA
      </div>
      <div className="leading-none">
        <span className="block text-base font-semibold tracking-tight text-ink-primary">ViralForge</span>
        <span className="mt-1 hidden text-[10px] uppercase tracking-[0.16em] text-ink-tertiary sm:block">Clips</span>
      </div>
    </div>
  );
}
