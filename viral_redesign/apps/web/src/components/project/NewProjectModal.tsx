'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, Captions, Check, Film, LinkIcon, Palette, Scissors, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { UploadVideoDropzone } from '@/components/upload/UploadVideoDropzone';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useQuota } from '@/hooks/useQuota';
import { captionThemeOptions, renderLayoutOptions } from '@/lib/project-options';
import type { CaptionTheme, ContentType, ClipStyle, RenderLayout } from '@/types/api.types';

const steps = [
  { label: 'Conteúdo', icon: LinkIcon },
  { label: 'Estratégia', icon: BrainCircuit },
  { label: 'Visual', icon: Palette },
];

const durationPresets = [
  { id: 'auto', label: 'Auto', seconds: 45, hint: 'A IA prioriza fechamento natural' },
  { id: 'short', label: 'Curto', seconds: 30, hint: '20-35s, ritmo rápido' },
  { id: 'medium', label: 'Médio', seconds: 45, hint: '35-55s, equilibrado' },
  { id: 'long', label: 'Longo', seconds: 75, hint: '55-90s, mais contexto' },
];

const contentTypes: Array<{ label: string; value: ContentType }> = [
  { label: 'Podcast', value: 'PODCAST' },
  { label: 'Entrevista', value: 'INTERVIEW' },
  { label: 'Aula', value: 'CLASS' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Palestra', value: 'TALK' },
  { label: 'Comédia', value: 'COMEDY' },
  { label: 'Gamer', value: 'GAMING' },
  { label: 'Mistério', value: 'MYSTERY' },
  { label: 'Notícia/opinião', value: 'NEWS' },
  { label: 'Outro', value: 'OTHER' },
];

const clipStyles: Array<{ label: string; value: ClipStyle }> = [
  { label: 'Alta retenção', value: 'VIRAL' },
  { label: 'Educativo', value: 'EDUCATIONAL' },
  { label: 'Polêmico', value: 'CONTROVERSIAL' },
  { label: 'Engraçado', value: 'FUNNY' },
  { label: 'Motivacional', value: 'MOTIVATIONAL' },
  { label: 'Vendas', value: 'SALES' },
  { label: 'Frases fortes', value: 'STRONG_QUOTES' },
];

type SourceMode = 'youtube' | 'upload';

const PODCAST_FRAME =
  "url('https://images.pexels.com/photos/10821605/pexels-photo-10821605.jpeg?auto=compress&cs=tinysrgb&w=900')";
const PODCAST_GUEST_FRAME =
  "url('https://images.pexels.com/photos/9897984/pexels-photo-9897984.jpeg?auto=compress&cs=tinysrgb&w=900')";
const SCREEN_FRAME =
  "url('https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=900&auto=format&fit=crop')";

function layoutFrame(layout: RenderLayout) {
  if (layout === 'CENTER_FIT') return 'center-fit';
  if (layout === 'TOP_FRAME') return 'top-frame';
  if (layout === 'PODCAST_SPLIT_STATIC') return 'podcast-split';
  if (layout === 'SCREEN_PLUS_FACE') return 'screen-face';
  if (layout === 'FILL_CROP' || layout === 'SPEAKER_CLOSEUP' || layout === 'SMART_CENTER') return 'full-crop';
  return 'blurred';
}

function CaptionOverlay({ theme, compact = false }: { theme: CaptionTheme; compact?: boolean }) {
  const boxed = ['CREATOR_BOX', 'CLEAN_EDITORIAL', 'KARAOKE_PRO', 'PODCAST_PRO'].includes(theme);
  const center = theme === 'STORY_IMPACT';
  const neon = theme === 'NEON_TECH';
  const yellow = theme === 'BOLD_FOOTER';
  const minimal = theme === 'MINIMAL';

  return (
    <div className={cn('absolute left-3 right-3 z-20 text-center', center ? 'top-[43%]' : compact ? 'bottom-3' : 'bottom-7')}>
      <p
        className={cn(
          'mx-auto inline-block max-w-full whitespace-pre-line px-2 py-1 uppercase leading-[1.05]',
          compact ? 'text-[10px]' : 'text-xl',
          minimal ? 'font-semibold normal-case' : 'font-black',
          boxed && 'rounded bg-black/75',
          neon && 'font-mono tracking-[0.12em] text-cyan-200',
          yellow && 'text-yellow-300',
          !neon && !yellow && 'text-white',
          theme === 'CLEAN_EDITORIAL' && 'normal-case',
        )}
        style={{
          textShadow: neon ? '0 0 14px rgba(34,211,238,.9)' : '2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000',
          letterSpacing: 0,
        }}
      >
        {center ? 'A VIRADA\nQUE NINGUEM VIU' : 'ISSO MUDA\nTUDO'}
      </p>
    </div>
  );
}

function PodcastFrame({ variant = 'host', className }: { variant?: 'host' | 'guest' | 'screen'; className?: string }) {
  const image = variant === 'guest' ? PODCAST_GUEST_FRAME : variant === 'screen' ? SCREEN_FRAME : PODCAST_FRAME;

  return (
    <div
      className={cn('absolute inset-0 bg-cover bg-center', className)}
      style={{ backgroundImage: image }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.42)_72%,rgba(0,0,0,.72))]" />
    </div>
  );
}

function VideoLayoutScene({ layout, captionTheme, compact = false }: { layout: RenderLayout; captionTheme: CaptionTheme; compact?: boolean }) {
  const frame = layoutFrame(layout);
  const frameClass = compact ? 'h-24 rounded-md' : 'aspect-[9/16] rounded-lg';
  const bg = 'bg-[radial-gradient(circle_at_50%_20%,rgba(45,212,191,.22),transparent_36%),linear-gradient(160deg,#18181b,#0a0a0d_58%,#050505)]';

  return (
    <div className={cn('relative overflow-hidden border border-white/10 bg-black', frameClass)}>
      {frame === 'podcast-split' ? (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative overflow-hidden"><PodcastFrame variant="host" className="scale-125" /></div>
          <div className="relative overflow-hidden"><PodcastFrame variant="guest" className="scale-125" /></div>
        </div>
      ) : frame === 'screen-face' ? (
        <>
          <div className={cn('absolute inset-0', bg)} />
          <div className="absolute left-[8%] right-[8%] top-[10%] h-[42%] overflow-hidden rounded border border-white/15 bg-zinc-950/80">
            <PodcastFrame variant="screen" />
          </div>
          <div className="absolute bottom-[24%] right-[10%] h-[28%] w-[32%] overflow-hidden rounded border border-white/20 bg-black">
            <PodcastFrame variant="host" className="scale-125" />
          </div>
        </>
      ) : frame === 'center-fit' ? (
        <>
          <div className="absolute inset-0 bg-black" />
          <div className="absolute left-0 right-0 top-[31%] h-[38%] overflow-hidden"><PodcastFrame variant="host" /></div>
        </>
      ) : frame === 'top-frame' ? (
        <>
          <div className="absolute inset-0 bg-black" />
          <div className="absolute left-0 right-0 top-[6%] h-[62%] overflow-hidden"><PodcastFrame variant="host" /></div>
        </>
      ) : frame === 'full-crop' ? (
        <PodcastFrame variant="host" className="scale-125" />
      ) : (
        <>
          <PodcastFrame variant="host" className="scale-125 blur-md" />
          <div className="absolute left-[7%] right-[7%] top-[6%] bottom-[6%] overflow-hidden rounded border border-white/10"><PodcastFrame variant="host" /></div>
        </>
      )}
      {!compact && <div className="absolute left-4 top-4 h-1.5 w-16 rounded-full bg-white/30" />}
      <CaptionOverlay theme={captionTheme} compact={compact} />
    </div>
  );
}

function SourcePreview({ sourceMode }: { sourceMode: SourceMode }) {
  return (
    <div className="rounded-lg border border-hairline-subtle bg-elevated p-4">
      <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 bg-[#08080a]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#18181b,#09090b)]" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-tertiary">
            {sourceMode === 'youtube' ? <LinkIcon className="h-3.5 w-3.5 text-accent" /> : <UploadCloud className="h-3.5 w-3.5 text-accent" />}
            Entrada
          </div>
          <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.6, repeat: Infinity }} className="h-2 w-2 rounded-full bg-emerald-300" />
        </div>
        <div className="absolute left-4 right-4 top-16 space-y-2">
          {[0.9, 0.62, 0.8, 0.45].map((width, index) => (
            <motion.span
              key={index}
              initial={{ scaleX: 0.2 }}
              animate={{ scaleX: width }}
              transition={{ duration: 1.2, delay: index * 0.12, repeat: Infinity, repeatType: 'reverse' }}
              className="block h-2 origin-left rounded-full bg-white/14"
            />
          ))}
        </div>
        <div className="absolute bottom-24 left-4 right-4 grid grid-cols-3 gap-2">
          {[Scissors, Film, Captions].map((Icon, index) => (
            <motion.div key={index} animate={{ y: [0, -4, 0] }} transition={{ duration: 2, delay: index * 0.18, repeat: Infinity }} className="grid aspect-[9/14] place-items-center rounded border border-white/10 bg-white/[0.06]">
              <Icon className="h-4 w-4 text-ink-secondary" />
            </motion.div>
          ))}
        </div>
        <div className="absolute bottom-5 left-4 right-4">
          <div className="mb-3 flex h-8 items-end gap-1">
            {Array.from({ length: 18 }).map((_, index) => (
              <motion.span
                key={index}
                animate={{ height: [`${20 + (index % 5) * 10}%`, `${58 + (index % 4) * 10}%`, `${20 + (index % 5) * 10}%`] }}
                transition={{ duration: 1.4, delay: index * 0.04, repeat: Infinity }}
                className="w-full rounded-full bg-accent/70"
              />
            ))}
          </div>
          <div className="h-1 rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-accent" animate={{ width: ['8%', '88%', '8%'] }} transition={{ duration: 3, repeat: Infinity }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [sourceMode, setSourceMode] = useState<SourceMode>('youtube');
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [language, setLanguage] = useState('pt-BR');
  const [contentType, setContentType] = useState<ContentType>('PODCAST');
  const [clipStyle, setClipStyle] = useState<ClipStyle>('VIRAL');
  const [durationPreset, setDurationPreset] = useState('auto');
  const [renderLayout, setRenderLayout] = useState<RenderLayout>('BLURRED_BACKGROUND');
  const [captionTheme, setCaptionTheme] = useState<CaptionTheme>('BOLD_CREATOR');
  const [submitting, setSubmitting] = useState(false);
  
  const { data: quota } = useQuota();

  const preferredDuration = durationPresets.find((preset) => preset.id === durationPreset)?.seconds ?? 45;
  const validYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/.test(youtubeUrl.trim());
  const validSource = sourceMode === 'youtube' ? validYoutubeUrl : Boolean(file);
  const validContent = title.trim().length >= 3 && validSource;
  const canAdvance = step === 0 ? validContent : true;

  function resetModal() {
    setStep(0);
    setSourceMode('youtube');
    setTitle('');
    setYoutubeUrl('');
    setFile(null);
    setUploadProgress(0);
    setSubmitting(false);
  }

  function closeCleanly() {
    resetModal();
    onClose();
  }

  async function submit() {
    if (!validContent || submitting) return;
    setSubmitting(true);
    try {
      const project = await api.projects.create({
        title: title.trim(),
        language,
        contentType,
        clipStyle,
        preferredClipDuration: preferredDuration,
        renderLayout,
        captionTheme,
      });

      capture('project_created', {
        projectId: project.id,
        contentType,
        clipStyle,
        targetDuration: preferredDuration,
        layout: renderLayout,
        captionTheme,
        videoSource: sourceMode,
      });

      if (sourceMode === 'youtube') {
        capture('project_youtube_submitted', { projectId: project.id });
        await api.projects.submitYoutubeUrl(project.id, youtubeUrl.trim());
      } else if (file) {
        capture('project_upload_started', {
          projectId: project.id,
          fileSizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10,
          fileType: file.type,
        });
        await api.projects.upload(project.id, file, setUploadProgress);
        capture('project_upload_completed', { projectId: project.id });
      }

      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetModal();
      onClose();
      router.push(`/dashboard/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar projeto');
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!canAdvance) {
      toast.error(sourceMode === 'youtube' ? 'Informe um título e um link válido antes de continuar' : 'Informe um título e selecione um vídeo antes de continuar');
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) {
          resetModal();
          onClose();
        }
      }}
      title="Novo projeto"
      description="Escolha a fonte, defina a estratégia e selecione a aparência antes de processar."
      className="max-w-5xl"
    >
      <div className="mb-6 grid grid-cols-3 gap-2">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const active = index === step;
          const done = index < step;
          return (
            <button
              key={item.label}
              type="button"
              disabled={submitting}
              onClick={() => (index <= step || validContent) && setStep(index)}
              className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', active && 'border-accent bg-accent/15 text-teal-100', done && 'border-success/40 bg-success/10 text-emerald-100', !active && !done && 'border-hairline-subtle bg-elevated text-ink-tertiary')}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              {item.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="content" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.18 }} className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <Input id="modal-title" label="Título do projeto" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Podcast sobre IA e mercado" />

              <div>
                <p className="mb-2 text-sm font-medium text-ink-secondary">Fonte do vídeo</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setSourceMode('youtube')} className={cn('rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', sourceMode === 'youtube' ? 'border-accent bg-accent/10' : 'border-hairline-subtle bg-elevated hover:border-hairline-strong')}>
                    <LinkIcon className="mb-3 h-5 w-5 text-accent" />
                    <span className="block text-sm font-medium text-ink-primary">YouTube</span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-tertiary">Menos atrito. Ideal para podcast e live públicos.</span>
                  </button>
                  <button type="button" onClick={() => setSourceMode('upload')} className={cn('rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', sourceMode === 'upload' ? 'border-accent bg-accent/10' : 'border-hairline-subtle bg-elevated hover:border-hairline-strong')}>
                    <UploadCloud className="mb-3 h-5 w-5 text-accent" />
                    <span className="block text-sm font-medium text-ink-primary">Upload fallback</span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-tertiary">Use MP4, MOV ou MKV até 500MB quando o link falhar.</span>
                  </button>
                </div>
              </div>

              {sourceMode === 'youtube' ? (
                <Input id="modal-youtube" label="Link do YouTube" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              ) : (
                <UploadVideoDropzone file={file} onFile={setFile} progress={uploadProgress} uploading={submitting} />
              )}

              <p className="rounded-xl border border-hairline-subtle bg-elevated px-4 py-3 text-xs leading-relaxed text-ink-secondary">
                O caminho principal continua sendo link. O upload fica visível como contingência operacional para quando o download externo quebrar.
              </p>
            </div>
            <SourcePreview sourceMode={sourceMode} />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="strategy" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.18 }} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select id="modal-language" label="Idioma" value={language} onChange={(event) => setLanguage(event.target.value)} options={[{ label: 'PT-BR', value: 'pt-BR' }, { label: 'EN', value: 'en' }, { label: 'ES', value: 'es' }]} />
              <Select id="modal-contentType" label="Tipo" value={contentType} onChange={(event) => setContentType(event.target.value as ContentType)} options={contentTypes} />
              <Select id="modal-style" label="Estilo" value={clipStyle} onChange={(event) => setClipStyle(event.target.value as ClipStyle)} options={clipStyles} />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-ink-secondary">Duração preferida</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {durationPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDurationPreset(preset.id)}
                    className={cn('rounded-xl border p-4 text-left transition hover:border-accent/50 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', durationPreset === preset.id ? 'border-accent bg-accent/10' : 'border-hairline-subtle bg-surface')}
                  >
                    <span className="block text-sm font-semibold text-ink-primary">{preset.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-tertiary">{preset.hint}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-tertiary">
                A duração é uma preferência, não uma regra fixa. Se uma ideia fecha melhor em 37s ou 68s, o validador preserva o fechamento natural.
              </p>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="visual" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.18 }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-secondary"><Palette className="h-4 w-4" /> Tela do vídeo</div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {renderLayoutOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.comingSoon}
                      onClick={() => !option.comingSoon && setRenderLayout(option.value)}
                      className={cn(
                        'relative rounded-lg border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        renderLayout === option.value ? 'border-accent bg-accent/10' : 'border-hairline-subtle bg-elevated hover:border-hairline-strong',
                        option.comingSoon && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <VideoLayoutScene layout={option.value} captionTheme={captionTheme} compact />
                      <p className="mt-2 text-xs font-medium text-ink-primary">{option.label}</p>
                      <p className="line-clamp-1 text-[11px] text-ink-tertiary">{option.description}</p>
                      {option.comingSoon && (
                        <span className="absolute right-1.5 top-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                          Em breve
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-secondary"><Captions className="h-4 w-4" /> Tema da legenda</div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {captionThemeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCaptionTheme(option.value)}
                      className={cn('rounded-lg border bg-elevated p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', captionTheme === option.value ? 'border-accent bg-accent/10' : 'border-hairline-subtle hover:border-hairline-strong')}
                    >
                      <div className="relative mb-2 h-14 overflow-hidden rounded bg-black">
                        <div className="absolute inset-0 bg-[linear-gradient(160deg,#1f2937,#050505)]" />
                        <CaptionOverlay theme={option.value} compact />
                      </div>
                      <p className="text-xs font-medium text-ink-primary">{option.label}</p>
                      <p className="text-[11px] text-ink-tertiary">{option.group}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-lg border border-hairline-subtle bg-elevated p-3">
                <VideoLayoutScene layout={renderLayout} captionTheme={captionTheme} />
                <div className="mt-3">
                  <p className="text-sm font-medium text-ink-primary">{renderLayoutOptions.find((option) => option.value === renderLayout)?.label}</p>
                  <p className="mt-1 text-xs text-ink-tertiary">{captionThemeOptions.find((option) => option.value === captionTheme)?.label}</p>
                </div>
              </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 border-t border-hairline-subtle pt-5">
        {step === 0 && quota && quota.plan === 'free' && quota.projectsUsed >= quota.projectsLimit - 1 && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            <strong>Aviso de uso:</strong> Você já usou {quota.projectsUsed} de {quota.projectsLimit} projetos do plano gratuito. Considere fazer um <Link href="/dashboard/billing" className="underline hover:text-amber-100">upgrade para o Pro</Link> para projetos ilimitados e remoção da marca d&apos;água.
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => (step === 0 ? closeCleanly() : setStep((current) => Math.max(0, current - 1)))}>
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
        <div className="flex gap-2">
          {step < steps.length - 1 ? (
            <Button type="button" onClick={next} disabled={!canAdvance || submitting}>
              Próximo
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={!validContent || submitting} loading={submitting}>
              {sourceMode === 'upload' && uploadProgress > 0 ? `Enviando ${uploadProgress}%` : 'Criar e processar'}
            </Button>
          )}
        </div>
        </div>
      </div>
    </Modal>
  );
}
