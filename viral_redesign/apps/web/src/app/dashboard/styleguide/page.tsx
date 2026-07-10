import { BrainCircuit, CheckCircle2, ScissorsLineDashed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/processing/ProgressBar';
import { ViralScoreBadge } from '@/components/clip/ViralScoreBadge';

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Design system</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-primary">Fundação visual</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          Tokens, primitivos e componentes de assinatura usados para manter o produto editorial, composto e cinematográfico.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['Base', 'bg-base', '#0A0A0A'],
          ['Surface', 'bg-surface', '#111111'],
          ['Elevated', 'bg-elevated', '#161616'],
          ['Accent', 'accent', '#7C3AED'],
        ].map(([label, token, value]) => (
          <div key={token} className="rounded-2xl border border-hairline-subtle bg-surface p-5 shadow-elevated">
            <div className={`mb-4 h-20 rounded-xl border border-hairline-subtle ${token === 'accent' ? 'bg-accent' : token}`} />
            <p className="text-sm font-medium text-ink-primary">{label}</p>
            <p className="mt-1 font-mono text-xs text-ink-tertiary">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <h2 className="text-xl font-semibold tracking-tight text-ink-primary">Primitivos</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Destrutivo</Button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input id="styleguide-email" label="Campo" placeholder="placeholder" />
            <Input id="styleguide-error" label="Com erro" defaultValue="valor" readOnly error="Mensagem inline" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge>default</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="danger">danger</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
          <h2 className="text-xl font-semibold tracking-tight text-ink-primary">Componentes de assinatura</h2>
          <div className="mt-5 grid gap-4">
            <div className="rounded-xl border border-hairline-subtle bg-elevated p-4">
              <div className="flex items-center gap-3">
                <ViralScoreBadge score={91} />
                <div>
                  <p className="text-sm font-medium text-ink-primary">Corte selecionado</p>
                  <p className="text-xs text-ink-tertiary">Hook forte, fechamento claro, score calibrado.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-hairline-subtle bg-elevated p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-secondary">
                <ScissorsLineDashed className="h-4 w-4 text-accent" /> Recorte manual
              </div>
              <ProgressBar value={64} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-hairline-subtle bg-elevated p-4">
                <BrainCircuit className="mb-3 h-5 w-5 text-accent" />
                <p className="text-sm font-medium text-ink-primary">Pass 1</p>
                <p className="text-xs text-ink-tertiary">Identificação rápida.</p>
              </div>
              <div className="rounded-xl border border-hairline-subtle bg-elevated p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-success" />
                <p className="text-sm font-medium text-ink-primary">Pass 2</p>
                <p className="text-xs text-ink-tertiary">Avaliação criteriosa.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
