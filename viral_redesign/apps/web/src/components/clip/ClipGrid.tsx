'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Filter, Loader2, Play, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { PublishDialog } from '@/components/publish/PublishDialog';
import { capture } from '@/lib/analytics';
import { api, authenticatedFetch } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import type { Clip } from '@/types/api.types';
import { ViralScoreBadge } from './ViralScoreBadge';
import { VideoPlayer } from './VideoPlayer';

function scoreOf(clip: Clip) {
  return clip.finalScore || clip.viralScore || 0;
}

function clipStatusLabel(clip: Clip) {
  if (clip.status === 'COMPLETED') return 'Pronto';
  if (clip.status === 'RENDERING') return 'Renderizando';
  if (clip.status === 'FAILED') return 'Falhou';
  return 'Na fila';
}

function clipStatusClass(clip: Clip) {
  if (clip.status === 'COMPLETED') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200';
  if (clip.status === 'RENDERING') return 'border-blue-400/20 bg-blue-400/10 text-blue-200';
  if (clip.status === 'FAILED') return 'border-red-400/20 bg-red-400/10 text-red-200';
  return 'border-white/10 bg-white/5 text-ink-tertiary';
}

function qualityLabel(clip: Clip) {
  if (clip.needsReview || clip.detectedWeakEnding || clip.status === 'FAILED') return 'Revisar';
  if (scoreOf(clip) >= 85) return 'Top momento';
  if (scoreOf(clip) >= 75) return 'Forte';
  return 'Ok';
}

function qualityClass(clip: Clip) {
  if (clip.needsReview || clip.detectedWeakEnding || clip.status === 'FAILED') return 'border-yellow-300/25 bg-yellow-300/10 text-yellow-200';
  if (scoreOf(clip) >= 85) return 'border-accent/35 bg-accent/15 text-teal-100';
  return 'border-white/10 bg-white/5 text-ink-secondary';
}

export function ClipGrid({ clips }: { clips: Clip[] }) {
  const queryClient = useQueryClient();
  const [busyClipId, setBusyClipId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [publishClip, setPublishClip] = useState<Clip | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const { data: accounts } = useQuery({
    queryKey: ['publish-accounts'],
    queryFn: () => api.publish.accounts() as Promise<Array<{ id: string; platform: string; platformAccountName: string | null; active: boolean }>>,
    enabled: publishClip !== null,
    staleTime: 60_000,
  });

  const sortedClips = useMemo(() => {
    let filtered = clips;
    if (filter === 'COMPLETED') filtered = clips.filter(c => c.status === 'COMPLETED');
    if (filter === 'RENDERING') filtered = clips.filter(c => c.status === 'RENDERING');
    if (filter === 'FAILED') filtered = clips.filter(c => c.status === 'FAILED');
    if (filter === 'REVIEW') filtered = clips.filter(c => c.needsReview || c.detectedWeakEnding || c.status === 'FAILED');
    if (filter === 'TOP') filtered = clips.filter(c => scoreOf(c) >= 85);
    return [...filtered].sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [clips, filter]);

  async function downloadClip(clip: Clip, positionInList: number) {
    setBusyClipId(clip.id);
    try {
      const response = await authenticatedFetch(api.clips.downloadUrl(clip.id));
      if (!response.ok) throw new Error('Falha ao baixar arquivo');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${clip.title.replace(/[^\w.-]+/g, '-').toLowerCase()}.mp4`;
      anchor.click();
      URL.revokeObjectURL(url);
      capture('clip_downloaded', {
        clipId: clip.id,
        projectId: clip.projectId,
        viralScore: clip.viralScore,
        finalScore: scoreOf(clip),
        closingStrength: clip.closingStrength,
        positionInList,
        from: 'project_results',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao baixar');
    } finally {
      setBusyClipId(null);
    }
  }

  async function deleteClip(clip: Clip) {
    const confirmed = window.confirm(`Apagar o corte "${clip.title}"? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;

    setBusyClipId(clip.id);
    try {
      await api.clips.remove(clip.id);
      capture('clip_deleted', {
        clipId: clip.id,
        projectId: clip.projectId,
        status: clip.status,
        viralScore: clip.viralScore,
        finalScore: scoreOf(clip),
        from: 'project_results',
      });
      queryClient.setQueryData<Clip[]>(['clips', clip.projectId], (current) => current?.filter((item) => item.id !== clip.id) ?? current);
      queryClient.setQueryData<import('@/types/api.types').Project>(['project', clip.projectId], (current) => {
        if (!current) return current;
        return {
          ...current,
          clips: current.clips?.filter((item) => item.id !== clip.id),
          _count: current._count ? { ...current._count, clips: Math.max(0, current._count.clips - 1) } : current._count,
        };
      });
      queryClient.setQueryData<import('@/types/api.types').Project[]>(['projects'], (current) =>
        current?.map((project) =>
          project.id === clip.projectId
            ? {
                ...project,
                clips: project.clips?.filter((item) => item.id !== clip.id),
                _count: project._count ? { ...project._count, clips: Math.max(0, project._count.clips - 1) } : project._count,
              }
            : project,
        ) ?? current,
      );
      await queryClient.invalidateQueries({ queryKey: ['clips', clip.projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project', clip.projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Corte apagado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao apagar corte');
    } finally {
      setBusyClipId(null);
    }
  }

  if (!clips.length) {
    return (
      <section className="rounded-lg border border-hairline bg-surface p-8 text-center">
        <p className="text-micro uppercase tracking-[0.18em] text-ink-tertiary">Momentos</p>
        <h2 className="mt-3 text-heading-md text-ink-primary">Nenhum corte encontrado</h2>
        <p className="mx-auto mt-3 max-w-lg text-body-sm text-ink-secondary">
          Este projeto terminou sem cortes aprovados. Tente reprocessar com outro estilo ou uma duração preferida diferente.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-heading-md text-ink-primary">Momentos</h2>
          <span className="font-mono-num text-caption text-ink-tertiary">{sortedClips.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            trigger={
              <Button type="button" variant={filter !== 'ALL' ? 'secondary' : 'ghost'} className="h-8 px-3 text-caption">
                <Filter className="h-4 w-4" /> {filter !== 'ALL' ? 'Filtro Ativo' : 'Filtrar'}
              </Button>
            }
          >
            <DropdownItem onSelect={() => setFilter('ALL')} className={filter === 'ALL' ? 'bg-elevated' : ''}>Todos os Cortes</DropdownItem>
            <DropdownItem onSelect={() => setFilter('TOP')} className={filter === 'TOP' ? 'bg-elevated text-accent' : ''}>Top Momentos</DropdownItem>
            <DropdownItem onSelect={() => setFilter('COMPLETED')} className={filter === 'COMPLETED' ? 'bg-elevated text-emerald-400' : ''}>Prontos</DropdownItem>
            <DropdownItem onSelect={() => setFilter('RENDERING')} className={filter === 'RENDERING' ? 'bg-elevated text-blue-400' : ''}>Renderizando</DropdownItem>
            <DropdownItem onSelect={() => setFilter('REVIEW')} className={filter === 'REVIEW' ? 'bg-elevated text-yellow-300' : ''}>Para Revisão</DropdownItem>
            <DropdownItem onSelect={() => setFilter('FAILED')} className={filter === 'FAILED' ? 'bg-elevated text-red-400' : ''}>Falhados</DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {sortedClips.map((clip, index) => {
          const isTop = index === 0;
          const busy = busyClipId === clip.id;
          const canDownload = clip.status === 'COMPLETED';
          const isPlaying = playingClipId === clip.id;

          return (
            <article
              key={clip.id}
              className="group relative overflow-hidden rounded-lg border border-hairline bg-surface transition-all duration-200 ease-defer hover:border-hairline-strong"
            >
              <div className="relative aspect-[9/16] overflow-hidden bg-elevated">
                {isPlaying ? (
                  <div className="absolute inset-0 bg-black">
                    <VideoPlayer
                      src={api.clips.downloadUrl(clip.id)}
                      onPlay={() =>
                        capture('clip_player_started', {
                          clipId: clip.id,
                          projectId: clip.projectId,
                          from: 'project_results_inline',
                          finalScore: scoreOf(clip),
                        })
                      }
                    />
                  </div>
                ) : clip.thumbnailPath ? (
                  <ProtectedImage
                    src={api.clips.thumbnailUrl(clip.id)}
                    alt={clip.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-reveal group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_50%_18%,rgba(20,184,166,.35),transparent_62%),linear-gradient(180deg,#27272a,#050505)]" />
                )}

                {!isPlaying && <div className="absolute inset-0 bg-gradient-to-t from-base/90 via-base/10 to-transparent" />}

                {!isPlaying && <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded bg-base/60 px-2 py-0.5 font-mono-num text-micro text-ink-secondary backdrop-blur">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {isTop && <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-micro font-medium text-accent">Top momento</span>}
                  {!isTop && (clip.needsReview || clip.detectedWeakEnding || clip.status === 'FAILED' || clip.status === 'RENDERING') && (
                    <span className={cn('rounded-full border px-2 py-0.5 text-micro font-medium backdrop-blur', qualityClass(clip))}>{qualityLabel(clip)}</span>
                  )}
                </div>}

                {!isPlaying && <div className="absolute right-3 top-3 flex translate-y-1 gap-2 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Publicar corte"
                    disabled={!canDownload || busy}
                    onClick={() => setPublishClip(clip)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/55 text-white/80 backdrop-blur transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Baixar corte"
                    disabled={!canDownload || busy}
                    onClick={() => downloadClip(clip, index + 1)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/55 text-white/80 backdrop-blur transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy && canDownload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Apagar corte"
                    disabled={busy}
                    onClick={() => deleteClip(clip)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-red-300/20 bg-black/55 text-red-100 backdrop-blur transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>}

                {!isPlaying && <div className="absolute inset-0 grid place-items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={canDownload ? 'Reproduzir corte' : 'Corte ainda não está pronto para reproduzir'}
                    disabled={!canDownload}
                    onClick={() => {
                      if (!canDownload) return;
                      setPlayingClipId(clip.id);
                      capture('clip_played_from_project_results', {
                        clipId: clip.id,
                        projectId: clip.projectId,
                        positionInList: index + 1,
                        finalScore: scoreOf(clip),
                      });
                    }}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-base/70 text-ink-primary backdrop-blur transition hover:bg-ink-primary hover:text-base">
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </span>
                  </button>
                </div>}

                {!isPlaying && <div className="absolute bottom-3 left-3 right-3">
                  <div className="mb-1 text-micro uppercase tracking-[0.12em] text-ink-tertiary">{clip.category} · {formatDuration(clip.duration)}</div>
                  <h3 className="line-clamp-2 text-body-sm leading-snug text-ink-primary">{clip.title}</h3>
                  {(clip.status === 'FAILED' || clip.status === 'RENDERING') && (
                    <div className="mt-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-medium backdrop-blur', clipStatusClass(clip))}>
                        {clip.status === 'RENDERING' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {clip.status === 'FAILED' && <AlertTriangle className="h-3 w-3" />}
                        {clipStatusLabel(clip)}
                      </span>
                    </div>
                  )}
                </div>}
              </div>

              <div className="p-4">
                {isTop ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono-num text-heading-sm text-accent">{scoreOf(clip)}</div>
                      <div className="text-micro uppercase tracking-[0.12em] text-ink-tertiary">Força</div>
                    </div>
                    <ViralScoreBadge score={scoreOf(clip)} />
                  </div>
                ) : (
                  <MomentStrengthBar score={scoreOf(clip)} />
                )}
                <p className="mt-3 line-clamp-2 text-caption leading-relaxed text-ink-tertiary">
                  {clip.hook ?? clip.shareabilityReason ?? clip.reason}
                </p>
                {clip.status === 'FAILED' && (
                  <p className="mt-2 line-clamp-2 text-caption text-red-200">{clip.errorMessage ?? 'Falha ao renderizar este corte.'}</p>
                )}
                <Link href={`/dashboard/${clip.projectId}/editor/${clip.id}`} className="mt-3 inline-flex text-caption text-ink-secondary transition hover:text-ink-primary">
                  Abrir no editor
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {publishClip && accounts && (
        <PublishDialog
          clip={publishClip}
          accounts={accounts}
          onClose={() => setPublishClip(null)}
          onPublished={() => {
            queryClient.invalidateQueries({ queryKey: ['published-clips'] });
          }}
        />
      )}
    </section>
  );
}

function MomentStrengthBar({ score }: { score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-ink-tertiary">Força do momento</span>
        <span className="font-mono-num text-caption text-ink-secondary">{score}/100</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}
