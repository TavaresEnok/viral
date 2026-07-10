'use client';

import { motion } from 'framer-motion';
import { Brain, Captions, CheckCircle2, Clock, Film, Scissors, ShieldCheck, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { ProcessingTimeline } from '@/components/processing/ProcessingTimeline';
import { ProgressBar } from '@/components/processing/ProgressBar';
import { StatusBadge } from '@/components/project/StatusBadge';
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
}

const stageCopy = [
  {
    min: 0,
    title: 'Preparando o projeto',
    description: 'Registrando o link e colocando o vídeo na fila certa.',
    icon: Clock,
  },
  {
    min: 8,
    title: 'Buscando o conteúdo',
    description: 'Baixando a fonte e validando se o vídeo está pronto para corte.',
    icon: Film,
  },
  {
    min: 22,
    title: 'Lendo o que foi dito',
    description: 'Usando legenda/transcrição para entender o contexto antes de cortar.',
    icon: Captions,
  },
  {
    min: 48,
    title: 'Procurando momentos fortes',
    description: 'A IA pontua abertura, fechamento, independência e potencial de compartilhamento.',
    icon: Brain,
  },
  {
    min: 70,
    title: 'Montando os cortes',
    description: 'Selecionando os melhores trechos e preparando o formato vertical.',
    icon: Scissors,
  },
  {
    min: 88,
    title: 'Renderizando a versão final',
    description: 'Aplicando layout, legenda e acabamento para entregar os vídeos.',
    icon: WandSparkles,
  },
];

const waitingTips = [
  'Você pode fechar esta página. O processamento continua em segundo plano.',
  'Cortes bons precisam começar forte e terminar em uma frase fechada.',
  'O ViralForge evita aprovar trechos que dependem demais do contexto anterior.',
  'Quando terminar, os cortes aparecem automaticamente nesta página.',
  'O editor profissional fica disponível para ajustes finos depois da geração.',
];

const checks = [
  { label: 'Hook forte nos primeiros segundos', at: 48 },
  { label: 'Final sem frase cortada no meio', at: 58 },
  { label: 'Legenda e layout vertical', at: 78 },
  { label: 'Vídeo pronto para download', at: 96 },
];

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress || 0)));
}

function currentStage(progress: number) {
  return [...stageCopy].reverse().find((item) => progress >= item.min) ?? stageCopy[0];
}

function readableJobStage(stage?: string | null) {
  if (!stage) return null;
  return stage
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ProcessingExperience({
  project,
  status,
  progress,
  jobStage,
  deletingProject,
  onDelete,
}: ProcessingExperienceProps) {
  const safeProgress = clampProgress(progress);
  const stage = currentStage(safeProgress);
  const StageIcon = stage.icon;
  const tip = waitingTips[Math.min(waitingTips.length - 1, Math.floor(safeProgress / 22))];
  const etapaAtual = Math.max(1, Math.min(7, Math.ceil(safeProgress / 15)));
  const normalizedStage = readableJobStage(jobStage);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(20,184,166,.18),transparent_26rem),radial-gradient(circle_at_88%_30%,rgba(250,204,21,.08),transparent_22rem)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      <div className="relative grid min-h-[680px] gap-8 p-5 md:p-8 xl:grid-cols-[0.88fr_1.12fr] xl:p-10">
        <section className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status ?? 'PROCESSING'} />
            <span className="rounded-full border border-hairline bg-elevated px-2.5 py-1 text-caption text-ink-secondary">
              Etapa {String(etapaAtual).padStart(2, '0')} / 07
            </span>
            {normalizedStage && (
              <span className="rounded-full border border-hairline bg-base/70 px-2.5 py-1 text-caption text-ink-tertiary">
                {normalizedStage}
              </span>
            )}
          </div>

          <div className="mt-8">
            <p className="text-micro uppercase tracking-[0.18em] text-ink-tertiary">Gerando seus cortes</p>
            <h1 className="mt-4 max-w-xl text-display-md text-ink-primary">
              Estamos transformando o vídeo em momentos prontos para postar.
            </h1>
            <p className="mt-5 max-w-lg text-body leading-relaxed text-ink-secondary">
              {stage.description}
            </p>
          </div>

          <div aria-live="polite" className="mt-8 rounded-xl border border-hairline bg-base/55 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent shadow-glow">
                <StageIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-heading-sm text-ink-primary">{stage.title}</h2>
                  <span className="font-mono-num text-heading-sm text-accent">{safeProgress}%</span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={safeProgress} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {checks.map((check) => {
              const done = safeProgress >= check.at;
              return (
                <div
                  key={check.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-hairline bg-base/35 p-3 text-caption transition-colors',
                    done ? 'text-ink-primary' : 'text-ink-tertiary',
                  )}
                >
                  <CheckCircle2 className={cn('h-4 w-4 shrink-0', done ? 'text-accent' : 'text-ink-tertiary')} />
                  {check.label}
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-8">
            <div className="rounded-xl border border-hairline-subtle bg-elevated/60 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <p className="text-caption font-medium text-ink-primary">{tip}</p>
                  <p className="mt-1 text-caption text-ink-tertiary">
                    Projeto: <span className="text-ink-secondary">{project.title}</span>
                  </p>
                </div>
              </div>
            </div>
            <Button type="button" variant="danger" className="mt-5" onClick={onDelete} loading={deletingProject}>
              <Trash2 className="h-4 w-4" /> Apagar projeto
            </Button>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.72fr] xl:gap-6">
          <ProcessingPreview progress={safeProgress} />
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-hairline-subtle bg-base/45 p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-elevated text-accent">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-heading-sm text-ink-primary">Fila de produção</h2>
                  <p className="text-caption text-ink-tertiary">Progresso real por etapa</p>
                </div>
              </div>
              <ProcessingTimeline progress={safeProgress} />
            </div>

            <div className="rounded-2xl border border-hairline-subtle bg-base/45 p-5">
              <p className="text-micro uppercase tracking-[0.16em] text-ink-tertiary">O que acontece agora</p>
              <div className="mt-4 space-y-3">
                <Insight label="Peneira" value="Encontra candidatos com hook" active={safeProgress >= 45} />
                <Insight label="Curadoria" value="Reprova cortes fracos" active={safeProgress >= 58} />
                <Insight label="Render" value="Gera vídeo final com legenda" active={safeProgress >= 72} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Insight({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-hairline bg-elevated/45 px-3 py-2.5">
      <div>
        <p className="text-caption font-medium text-ink-primary">{label}</p>
        <p className="text-micro text-ink-tertiary">{value}</p>
      </div>
      <span className={cn('h-2 w-2 rounded-full', active ? 'bg-accent shadow-glow' : 'bg-ink-tertiary/35')} />
    </div>
  );
}

function ProcessingPreview({ progress }: { progress: number }) {
  const cards = [
    { label: 'Hook', score: Math.min(98, Math.max(62, progress + 24)), top: '10%', left: '8%' },
    { label: 'Corte', score: Math.min(94, Math.max(58, progress + 12)), top: '43%', left: '4%' },
    { label: 'Legenda', score: Math.min(91, Math.max(55, progress + 8)), top: '67%', left: '13%' },
  ];

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-hairline-subtle bg-[#090909] p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(20,184,166,.14),transparent_20rem)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:38px_38px]" />

      <div className="relative flex h-full min-h-[580px] items-center justify-center">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            className="absolute z-20 hidden rounded-xl border border-white/10 bg-surface/85 px-3 py-2 shadow-elevated backdrop-blur md:block"
            style={{ top: card.top, left: card.left }}
            animate={{ y: [0, -8, 0], opacity: [0.82, 1, 0.82] }}
            transition={{ duration: 3.2 + index * 0.35, repeat: Infinity, ease: 'easeInOut' }}
          >
            <p className="text-micro uppercase tracking-[0.14em] text-ink-tertiary">{card.label}</p>
            <p className="mt-1 font-mono-num text-heading-sm text-accent">{card.score}</p>
          </motion.div>
        ))}

        <div className="relative aspect-[9/16] h-[500px] max-h-[74vh] overflow-hidden rounded-[2rem] border border-white/10 bg-elevated shadow-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(15,118,110,.26),rgba(10,10,10,.18)_42%,rgba(250,204,21,.10))]" />
          <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between">
            <span className="rounded-full bg-black/35 px-2 py-1 font-mono-num text-[10px] text-white/80 backdrop-blur">ViralForge</span>
            <span className="rounded-full bg-accent/90 px-2 py-1 font-mono-num text-[10px] text-white shadow-glow">{progress}%</span>
          </div>

          <motion.div
            className="absolute inset-x-10 top-20 h-56 rounded-[1.5rem] border border-white/10 bg-black/30 backdrop-blur-sm"
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute left-1/2 top-10 h-20 w-20 -translate-x-1/2 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-500 shadow-[0_0_50px_rgba(20,184,166,.25)]" />
            <div className="absolute left-1/2 top-32 h-24 w-32 -translate-x-1/2 rounded-t-[2rem] bg-gradient-to-br from-zinc-700 to-zinc-900" />
            <motion.div
              className="absolute inset-x-8 top-8 h-28 rounded-2xl border-2 border-accent/70 shadow-glow"
              animate={{ x: [-8, 10, -4, -8], y: [0, 6, -3, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

          <div className="absolute inset-x-7 bottom-24 z-20 space-y-2 text-center">
            <motion.div
              className="mx-auto w-fit rounded-lg bg-black/70 px-3 py-2 text-lg font-extrabold uppercase leading-none tracking-tight text-white shadow-lg"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Cortes com <span className="text-accent">gancho</span>
            </motion.div>
            <div className="mx-auto h-2 w-32 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{ width: ['18%', '82%', '48%', '92%'] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>

          <motion.div
            className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-accent/12 to-transparent"
            animate={{ y: [0, 420, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="absolute inset-x-5 bottom-5 z-20 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="aspect-[9/16] rounded-lg border border-white/10 bg-black/30 p-1">
                <div className="h-full rounded-md bg-gradient-to-b from-white/15 to-accent/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
