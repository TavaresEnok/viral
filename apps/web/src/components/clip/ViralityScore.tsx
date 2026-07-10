'use client';

import { Sparkles, TrendingUp, Share2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Clip } from '@/types/api.types';

function scoreOf(clip: Clip): number {
  return clip.finalScore || clip.viralScore || 0;
}

/** Faixa de apresentação alinhada à curva do backend (corte aprovado ~80-92). */
function tier(score: number): { label: string; className: string } {
  if (score >= 90) return { label: 'Viral', className: 'text-[color:var(--accent-text)]' };
  if (score >= 80) return { label: 'Forte', className: 'text-[color:var(--accent-text)]' };
  if (score >= 70) return { label: 'Bom', className: 'text-ink-primary' };
  return { label: 'Revisar', className: 'text-[#FFC24B]' };
}

const RISK_LABELS: Record<string, { label: string; className: string }> = {
  high: { label: 'Risco alto de corte ruim', className: 'text-[#FF8A8A]' },
  medium: { label: 'Risco médio de corte', className: 'text-[#FFC24B]' },
};

function Dimension({ label, value }: { label: string; value?: number | null }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">{label}</span>
        <span className="font-mono text-xs font-bold text-ink-primary">{v ?? '—'}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-elevated">
        <div
          className={cn('h-full rounded-pill', v != null && v >= 75 ? 'bg-accent' : 'bg-ink-tertiary/50')}
          style={{ width: `${v ?? 0}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Mostra o virality score COM o porquê — abertura, fechamento, contexto, emoção
 * e quotabilidade, mais os motivos textuais. Concorrentes (Vizard etc.) exibem
 * o score como caixa-preta; aqui o creator vê exatamente o que sustenta a nota.
 */
export function ViralityScore({ clip, className }: { clip: Clip; className?: string }) {
  const score = scoreOf(clip);
  const { label, className: tierClass } = tier(score);
  const risk = clip.riskOfBadCut ? RISK_LABELS[clip.riskOfBadCut] : undefined;

  return (
    <section className={cn('rounded-card border border-hairline-subtle bg-surface p-5', className)}>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-elevated">
          <span className={cn('font-mono text-2xl font-extrabold leading-none', tierClass)}>{score}</span>
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-tertiary">score</span>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-base font-extrabold text-ink-primary">
            <Sparkles className="h-4 w-4 text-[color:var(--accent-text)]" strokeWidth={2} />
            Potencial {label}
          </p>
          <p className="mt-0.5 text-xs text-ink-secondary">Nota calculada por 5 dimensões de viralidade.</p>
          {risk && (
            <p className={cn('mt-1.5 flex items-center gap-1 text-[11px] font-semibold', risk.className)}>
              <AlertTriangle className="h-3 w-3" /> {risk.label}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
        <Dimension label="Abertura" value={clip.openingStrength} />
        <Dimension label="Fechamento" value={clip.closingStrength} />
        <Dimension label="Contexto" value={clip.contextIndependenceScore} />
        <Dimension label="Emoção" value={clip.emotionalDensity} />
        <Dimension label="Quotabilidade" value={clip.quotability} />
        <Dimension label="Viral (IA)" value={clip.viralScore} />
      </div>

      {(clip.firstThreeSecondsHook || clip.shareabilityReason) && (
        <div className="mt-5 space-y-2.5 border-t border-hairline-subtle pt-4">
          {clip.firstThreeSecondsHook && (
            <p className="flex gap-2 text-xs leading-relaxed text-ink-secondary">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--accent-text)]" strokeWidth={2} />
              <span><span className="font-semibold text-ink-primary">Por que prende:</span> {clip.firstThreeSecondsHook}</span>
            </p>
          )}
          {clip.shareabilityReason && (
            <p className="flex gap-2 text-xs leading-relaxed text-ink-secondary">
              <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--accent-text)]" strokeWidth={2} />
              <span><span className="font-semibold text-ink-primary">Por que compartilham:</span> {clip.shareabilityReason}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
