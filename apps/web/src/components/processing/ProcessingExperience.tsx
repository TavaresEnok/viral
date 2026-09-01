'use client';

import { ArrowRight, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { Project, ProjectStatus } from '@/types/api.types';

interface ProcessingExperienceProps {
  project: Project;
  status?: ProjectStatus;
  progress: number;
  jobStage?: string | null;
  deletingProject: boolean;
  onDelete: () => void;
  clipCount?: number;
  onSeeClips?: () => void;
}

const stages = [
  { min: 0, label: 'Baixando o vídeo' },
  { min: 22, label: 'Transcrevendo' },
  { min: 48, label: 'Caçando momentos' },
  { min: 70, label: 'Cortando 9:16' },
  { min: 82, label: 'Queimando legenda' },
  { min: 92, label: 'Renderizando' },
];

const STAGE_BY_KEY: Record<string, number> = {
  STARTING: 0,
  DOWNLOADING_VIDEO: 0,
  EXTRACTING_AUDIO: 1,
  TRANSCRIBING: 1,
  ANALYZING_CLIPS: 2,
  SAVING_CLIPS: 3,
  RENDERING: 4,
  COMPLETED: 6,
};

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress || 0)));
}

function readableJobStage(stage?: string | null) {
  if (!stage) return null;
  return stage.toLowerCase().replace(/_/g, ' ');
}

export function ProcessingExperience({
  project: _project,
  status,
  progress,
  jobStage,
  deletingProject,
  onDelete,
  clipCount = 0,
  onSeeClips,
}: ProcessingExperienceProps) {
  const completed = status === 'COMPLETED';
  const safeProgress = completed ? 100 : clampProgress(progress);
  const stageFromKey = jobStage ? STAGE_BY_KEY[jobStage.toUpperCase()] : undefined;
  const progressIndex = stages.reduce((acc, stage, index) => (safeProgress >= stage.min ? index : acc), 0);
  const activeIndex = completed
    ? stages.length
    : Math.max(0, stageFromKey !== undefined ? Math.max(stageFromKey, progressIndex) : progressIndex);
  const currentStage = stages[Math.min(activeIndex, stages.length - 1)];
  const normalizedStage = readableJobStage(jobStage);

  return (
    <div className="mx-auto grid max-w-[1100px] gap-10 px-1 py-2 md:px-4 md:py-4 lg:grid-cols-[1fr_340px]">
      <section className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-pill border border-hairline-strong px-3.5 py-1.5 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-secondary">
          <span
            aria-hidden="true"
            className={cn('h-2 w-2 rounded-pill', completed ? 'bg-accent' : 'bg-special')}
            style={completed ? undefined : { animation: 'vr-blink 1.5s ease-in-out infinite' }}
          />
          {completed ? 'pronto' : 'processando'}
        </span>

        <h1 className="mt-5 max-w-xl font-display text-display-md font-extrabold text-ink-primary">
          {completed ? 'Cortes prontos pra postar' : 'A IA tá caçando seus melhores momentos'}
        </h1>
        <p className="mt-4 max-w-lg text-body leading-relaxed text-ink-secondary">
          Transcrevemos tudo, pontuamos cada trecho e cortamos só o que tem gancho forte e fechamento limpo.
        </p>

        {completed ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-card bg-accent p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-heading-md font-extrabold text-[#10120A]">
                {clipCount > 0 ? `${clipCount} ${clipCount === 1 ? 'corte pronto' : 'cortes prontos'}!` : 'Tudo pronto!'}
              </p>
              <p className="mt-1 text-sm font-medium text-[#10120A]/75">Baixa, edita ou posta direto.</p>
            </div>
            <Button
              type="button"
              onClick={onSeeClips}
              className="shrink-0 bg-[#10120A] text-accent hover:brightness-125"
            >
              Ver meus cortes <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </Button>
          </div>
        ) : (
          <div aria-live="polite" className="mt-8 rounded-card border border-hairline-subtle bg-surface p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-base font-bold text-ink-primary">{currentStage.label}</h2>
              <span className="font-mono text-[28px] font-bold leading-none text-[color:var(--accent-text)]">{safeProgress}%</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-pill bg-elevated">
              <div className="h-full rounded-pill bg-progress-viral transition-all duration-500 ease-smooth" style={{ width: `${safeProgress}%` }} />
            </div>
            {normalizedStage && (
              <p className="mt-3 font-mono text-micro uppercase tracking-[0.12em] text-ink-tertiary">{normalizedStage}</p>
            )}
          </div>
        )}

        <ol className="mt-6 space-y-2.5">
          {stages.map((stage, index) => {
            const done = completed || index < activeIndex || safeProgress >= 100;
            const active = !completed && index === activeIndex;
            return (
              <li
                key={stage.label}
                className={cn(
                  'flex items-center gap-3 rounded-input border px-4 py-3 text-sm transition duration-200',
                  active
                    ? 'border-accent bg-[color:var(--accent-glow)] text-ink-primary shadow-glow'
                    : done
                      ? 'border-hairline-subtle bg-surface text-ink-primary'
                      : 'border-hairline-subtle bg-surface text-ink-tertiary',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-pill',
                    done ? 'bg-accent text-[#10120A]' : active ? 'bg-accent/30' : 'bg-elevated',
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  {active && <span className="h-2 w-2 rounded-pill bg-accent" style={{ animation: 'vr-blink 1.5s ease-in-out infinite' }} />}
                </span>
                <span className={cn('font-medium', active && 'font-semibold')}>{stage.label}</span>
                {active && (
                  <span className="ml-auto font-mono text-micro uppercase tracking-[0.12em] text-[color:var(--accent-text)]">agora</span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-tertiary">Pode fechar essa página — a gente continua trabalhando.</p>
          <Button type="button" variant="danger" size="sm" onClick={onDelete} loading={deletingProject}>
            <Trash2 className="h-4 w-4" strokeWidth={1.6} /> Apagar vídeo
          </Button>
        </div>
      </section>

      {/* Celular 9:16 com scan line */}
      <aside className="hidden justify-center lg:flex lg:items-start">
        <div className="relative w-[280px] overflow-hidden rounded-[24px] border border-hairline-strong bg-[#101016]" style={{ aspectRatio: '9/16' }}>
          <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(200,245,66,0.06),transparent_40%,rgba(0,0,0,0.5))]" />

          <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between">
            <span className="rounded-pill bg-black/65 px-2.5 py-1 font-display text-[11px] font-extrabold lowercase text-white backdrop-blur">viral.</span>
            <span className="rounded-pill bg-accent px-2.5 py-1 font-mono text-[11px] font-bold text-[#10120A]">{safeProgress}%</span>
          </div>

          {/* ondas de transcrição */}
          <div className="absolute left-5 right-5 top-[22%] space-y-2.5">
            {[0.9, 0.65, 0.82, 0.5].map((width, index) => (
              <span
                key={index}
                className={cn('block h-2 rounded-pill', index === 2 ? 'bg-accent/70' : 'bg-white/12')}
                style={{ width: `${width * 100}%` }}
              />
            ))}
          </div>

          {/* legenda estilo creator */}
          <div className="absolute inset-x-4 bottom-[26%] z-10 text-center">
            <span
              className="font-display text-lg font-extrabold uppercase leading-[1.1] text-white"
              style={{ textShadow: '2px 2px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000' }}
            >
              {completed ? 'GANCHO ENCONTRADO' : 'CAÇANDO O GANCHO…'}
            </span>
          </div>

          {/* 3 mini-clips pulsando */}
          <div className="absolute inset-x-4 bottom-4 z-10 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="aspect-[9/14] rounded-[9px] border border-white/10 bg-white/[0.07]"
                style={{ animation: `vr-blink ${2 + index * 0.4}s ease-in-out infinite` }}
              />
            ))}
          </div>

          {/* linha de scan */}
          {!completed && (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(200,245,66,0.18),transparent)]"
              style={{ animation: 'vr-scan 3.2s linear infinite' }}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
