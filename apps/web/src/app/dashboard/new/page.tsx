'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LinkIcon, SlidersHorizontal, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UploadVideoDropzone } from '@/components/upload/UploadVideoDropzone';
import { CaptionSample, LayoutMiniPreview, PhonePreview } from '@/components/project/visual-previews';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useQuota } from '@/hooks/useQuota';
import { captionThemeOptions, languageOptions, renderLayoutOptions } from '@/lib/project-options';
import type { CaptionTheme, ContentType, ClipStyle, RenderLayout } from '@/types/api.types';

const durationPresets = [
  { id: 'auto', label: 'Auto', seconds: 45, hint: 'A IA prioriza fechamento natural' },
  { id: 'short', label: 'Curto', seconds: 30, hint: '20-35s, ritmo rápido' },
  { id: 'medium', label: 'Médio', seconds: 45, hint: '35-55s, equilibrado' },
  { id: 'long', label: 'Longo', seconds: 75, hint: '55-90s, mais contexto' },
];

const languages = languageOptions;

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

function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-pill border px-4 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-accent bg-accent font-bold text-[#10120A]'
          : 'border-hairline-strong bg-transparent text-ink-secondary hover:border-ink-tertiary hover:text-ink-primary',
      )}
    >
      {children}
    </button>
  );
}

const validLayouts = new Set(renderLayoutOptions.filter((option) => !option.comingSoon).map((option) => option.value));
const validCaptions = new Set(captionThemeOptions.map((option) => option.value));

export default function NewCutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // Templates ("Usar agora") pré-preenchem layout e legenda via query string.
  const presetLayout = searchParams?.get('layout') as RenderLayout | null;
  const presetCaption = searchParams?.get('caption') as CaptionTheme | null;
  const [sourceMode, setSourceMode] = useState<SourceMode>('youtube');
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState(searchParams?.get('url') ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [language, setLanguage] = useState('pt-BR');
  const [contentType, setContentType] = useState<ContentType>('PODCAST');
  const [clipStyle, setClipStyle] = useState<ClipStyle>('VIRAL');
  const [durationPreset, setDurationPreset] = useState('auto');
  const [renderLayout, setRenderLayout] = useState<RenderLayout>(
    presetLayout && validLayouts.has(presetLayout) ? presetLayout : 'BLURRED_BACKGROUND',
  );
  const [captionTheme, setCaptionTheme] = useState<CaptionTheme>(
    presetCaption && validCaptions.has(presetCaption) ? presetCaption : 'BOLD_CREATOR',
  );
  // Abre as opções já expandidas se o usuário veio de um template com presets.
  const [showAdvanced, setShowAdvanced] = useState(Boolean(presetLayout || presetCaption));
  const [submitting, setSubmitting] = useState(false);

  const { data: quota } = useQuota();

  const preferredDuration = durationPresets.find((preset) => preset.id === durationPreset)?.seconds ?? 45;
  const validYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/.test(youtubeUrl.trim());
  const validSource = sourceMode === 'youtube' ? validYoutubeUrl : Boolean(file);
  const validContent = title.trim().length >= 3 && validSource;

  async function submit() {
    if (!validContent || submitting) {
      if (!validContent) {
        toast.error(sourceMode === 'youtube' ? 'Dá um nome e cola um link válido' : 'Dá um nome e escolhe um vídeo');
      }
      return;
    }
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
      router.push(`/dashboard/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar o corte');
      setSubmitting(false);
    }
  }

  const selectedLayout = renderLayoutOptions.find((option) => option.value === renderLayout);
  const selectedCaption = captionThemeOptions.find((option) => option.value === captionTheme);

  return (
    <div className="mx-auto max-w-[1100px] px-1 py-2 md:px-4 md:py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">novo corte</p>
          <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Cola o vídeo e a IA faz o resto</h1>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-6">
          {/* Fonte do vídeo */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSourceMode('youtube')}
              className={cn(
                'rounded-card border-[1.5px] p-5 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                sourceMode === 'youtube' ? 'border-accent bg-[color:var(--accent-glow)]' : 'border-hairline-subtle bg-surface hover:border-hairline-strong',
              )}
            >
              <LinkIcon className={cn('mb-3 h-5 w-5', sourceMode === 'youtube' ? 'text-[color:var(--accent-text)]' : 'text-ink-tertiary')} strokeWidth={1.6} />
              <span className="block font-display text-base font-bold text-ink-primary">Link do YouTube</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-secondary">Cola o link e pronto. Vídeo, live e podcast públicos.</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={cn(
                'rounded-card border-[1.5px] p-5 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                sourceMode === 'upload' ? 'border-accent bg-[color:var(--accent-glow)]' : 'border-hairline-subtle bg-surface hover:border-hairline-strong',
              )}
            >
              <UploadCloud className={cn('mb-3 h-5 w-5', sourceMode === 'upload' ? 'text-[color:var(--accent-text)]' : 'text-ink-tertiary')} strokeWidth={1.6} />
              <span className="block font-display text-base font-bold text-ink-primary">Upload de arquivo</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-secondary">MP4, MOV ou MKV até 500MB, do seu computador.</span>
            </button>
          </div>

          {/* Nome + fonte */}
          <div className="space-y-5">
            <Input id="new-title" label="Nome do projeto" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Podcast #043 — convidado surpresa" />

            {sourceMode === 'youtube' ? (
              <Input
                id="new-youtube"
                label="Link do YouTube"
                className="font-mono text-[13px]"
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            ) : (
              <UploadVideoDropzone file={file} onFile={setFile} progress={uploadProgress} uploading={submitting} />
            )}
          </div>

          {/* Opções avançadas (recolhidas por padrão) */}
          <div className="rounded-card border border-hairline-subtle bg-surface">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-card"
            >
              <span className="flex items-center gap-2.5">
                <SlidersHorizontal className="h-4 w-4 text-ink-tertiary" strokeWidth={1.8} />
                <span className="font-display text-sm font-bold text-ink-primary">Opções avançadas</span>
                <span className="text-xs text-ink-tertiary">estilo, idioma, layout e legenda</span>
              </span>
              <ChevronDown className={cn('h-4 w-4 text-ink-tertiary transition-transform duration-200', showAdvanced && 'rotate-180')} strokeWidth={2} />
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  key="advanced"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-7 border-t border-hairline-subtle p-5">
                    <section>
                      <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">tipo de conteúdo</p>
                      <div className="flex flex-wrap gap-2">
                        {contentTypes.map((option) => (
                          <Chip key={option.value} selected={contentType === option.value} onClick={() => setContentType(option.value)}>
                            {option.label}
                          </Chip>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">estilo dos cortes</p>
                      <div className="flex flex-wrap gap-2">
                        {clipStyles.map((option) => (
                          <Chip key={option.value} selected={clipStyle === option.value} onClick={() => setClipStyle(option.value)}>
                            {option.label}
                          </Chip>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">idioma</p>
                      <div className="flex flex-wrap gap-2">
                        {languages.map((option) => (
                          <Chip key={option.value} selected={language === option.value} onClick={() => setLanguage(option.value)}>
                            {option.label}
                          </Chip>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">duração dos cortes</p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        {durationPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setDurationPreset(preset.id)}
                            className={cn(
                              'rounded-card border-[1.5px] p-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                              durationPreset === preset.id ? 'border-accent bg-[color:var(--accent-glow)]' : 'border-hairline-subtle bg-base hover:border-hairline-strong',
                            )}
                          >
                            <span className="block font-display text-sm font-bold text-ink-primary">{preset.label}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-ink-tertiary">{preset.hint}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">layout do vídeo</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {renderLayoutOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRenderLayout(option.value)}
                            title={option.description}
                            className={cn(
                              'rounded-input border-[1.5px] p-2 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                              renderLayout === option.value ? 'border-accent bg-[color:var(--accent-glow)]' : 'border-hairline-subtle bg-base hover:border-hairline-strong',
                            )}
                          >
                            <LayoutMiniPreview layout={option.value} />
                            <p className="mt-2 text-center text-[11px] font-semibold leading-tight text-ink-primary">{option.label}</p>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="mb-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink-tertiary">estilo da legenda</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {captionThemeOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCaptionTheme(option.value)}
                            className={cn(
                              'rounded-input border-[1.5px] p-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                              captionTheme === option.value ? 'border-accent bg-[color:var(--accent-glow)]' : 'border-hairline-subtle bg-base hover:border-hairline-strong',
                            )}
                          >
                            <div className="relative mb-2 grid h-16 place-items-center overflow-hidden rounded-[8px] bg-[#101016] px-2 text-center text-[11px]">
                              <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
                              <CaptionSample theme={option.value} className="relative" />
                            </div>
                            <p className="text-xs font-semibold text-ink-primary">{option.label}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Preview sticky */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-hairline-subtle bg-surface p-4">
            <span className="mb-3 inline-block rounded-pill bg-accent px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#10120A]">
              preview
            </span>
            <PhonePreview layout={renderLayout} captionTheme={captionTheme} />
            <dl className="mt-4 space-y-2 text-xs">
              {[
                ['tipo', contentTypes.find((option) => option.value === contentType)?.label],
                ['estilo', clipStyles.find((option) => option.value === clipStyle)?.label],
                ['duração', durationPresets.find((preset) => preset.id === durationPreset)?.label],
                ['layout', selectedLayout?.label],
                ['legenda', selectedCaption?.label],
              ].map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="font-mono uppercase tracking-[0.1em] text-ink-tertiary">{key}</dt>
                  <dd className="font-semibold text-ink-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      {/* Rodapé */}
      <div className="mt-10 border-t border-hairline-subtle pt-6">
        {quota && quota.plan?.toUpperCase() !== 'PRO' && quota.projectsUsed >= quota.projectsLimit - 1 && (
          <div className="mb-5 rounded-input border border-[rgba(255,194,75,0.3)] bg-[rgba(255,194,75,0.1)] p-4 text-sm text-[#FFC24B]">
            Você já usou {quota.projectsUsed} de {quota.projectsLimit} vídeos do plano Free.{' '}
            <Link href="/dashboard/billing" className="font-bold underline">
              Vira Pro
            </Link>{' '}
            pra ter mais cortes e sem marca d&apos;água.
          </div>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" disabled={submitting} onClick={() => router.push('/dashboard')}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!validContent || submitting} loading={submitting} className="shadow-glow">
            {sourceMode === 'upload' && uploadProgress > 0 ? `Enviando ${uploadProgress}%` : 'Gerar cortes ✦'}
          </Button>
        </div>
      </div>
    </div>
  );
}
