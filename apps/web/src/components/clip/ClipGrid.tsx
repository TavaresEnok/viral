'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Play, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { Button } from '@/components/ui/Button';
import { PublishDialog } from '@/components/publish/PublishDialog';
import { capture } from '@/lib/analytics';
import { api, authenticatedFetch } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import type { Clip } from '@/types/api.types';
import { VideoPlayer } from './VideoPlayer';

function scoreOf(clip: Clip) {
  return clip.finalScore || clip.viralScore || 0;
}

/** Cor do badge de score por faixa — fundo sólido p/ ler em qualquer thumbnail. */
function scoreBadge(score: number): { bg: string; label: string } {
  if (score >= 85) return { bg: 'bg-[color:var(--accent)] text-[#10120A]', label: 'VIRAL' };
  if (score >= 70) return { bg: 'bg-emerald-500 text-white', label: 'FORTE' };
  if (score >= 50) return { bg: 'bg-amber-400 text-[#10120A]', label: 'BOM' };
  return { bg: 'bg-zinc-600 text-white', label: 'REVISAR' };
}

const filters = [
  { id: 'ALL', label: 'Todos' },
  { id: 'SCORE90', label: 'Score 90+' },
  { id: 'SHORT45', label: 'Até 45s' },
] as const;

type FilterId = (typeof filters)[number]['id'];

export function ClipGrid({ clips }: { clips: Clip[] }) {
  const queryClient = useQueryClient();
  const [busyClipId, setBusyClipId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [publishClip, setPublishClip] = useState<Clip | null>(null);
  const [filter, setFilter] = useState<FilterId>('ALL');
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['publish-accounts'],
    queryFn: () => api.publish.accounts() as Promise<Array<{ id: string; platform: string; platformAccountName: string | null; active: boolean }>>,
    enabled: publishClip !== null,
    staleTime: 60_000,
  });

  const sortedClips = useMemo(() => {
    let filtered = clips;
    if (filter === 'SCORE90') filtered = clips.filter((clip) => scoreOf(clip) >= 90);
    if (filter === 'SHORT45') filtered = clips.filter((clip) => clip.duration <= 45);
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
      <section className="rounded-card border border-hairline-subtle bg-surface p-10 text-center">
        <h2 className="font-display text-heading-md font-bold text-ink-primary">Nenhum corte encontrado</h2>
        <p className="mx-auto mt-3 max-w-lg text-body-sm text-ink-secondary">
          Esse vídeo terminou sem cortes aprovados. Tenta reprocessar com outro estilo ou outra duração.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              'rounded-pill border px-4 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              filter === item.id
                ? 'border-accent bg-accent font-bold text-[#10120A]'
                : 'border-hairline-strong text-ink-secondary hover:border-ink-tertiary hover:text-ink-primary',
            )}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-caption text-ink-tertiary">{sortedClips.length} cortes</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[18px]">
        {sortedClips.map((clip, index) => {
          const busy = busyClipId === clip.id;
          const canDownload = clip.status === 'COMPLETED';
          const isPlaying = playingClipId === clip.id;
          const score = scoreOf(clip);

          return (
            <article
              key={clip.id}
              className="group relative overflow-hidden rounded-card border border-hairline-subtle bg-surface transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-hairline-strong"
            >
              <div className="relative aspect-[9/16] overflow-hidden bg-[#101016]">
                <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
                {isPlaying ? (
                  <div className="absolute inset-0 bg-black">
                    <VideoPlayer
                      src={api.clips.downloadUrl(clip.id)}
                      onPlay={() =>
                        capture('clip_player_started', {
                          clipId: clip.id,
                          projectId: clip.projectId,
                          from: 'project_results_inline',
                          finalScore: score,
                        })
                      }
                    />
                  </div>
                ) : clip.thumbnailPath ? (
                  <ProtectedImage
                    src={api.clips.thumbnailUrl(clip.id)}
                    alt={clip.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-reveal group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(160deg,#1B2412,#0C0C11_55%,#16101C)]" />
                )}

                {!isPlaying && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />

                    <div className="absolute left-3 top-3">
                      <div
                        className={cn(
                          'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.55)] ring-1 ring-black/15',
                          scoreBadge(score).bg,
                        )}
                      >
                        <TrendingUp className="h-4 w-4" strokeWidth={2.6} />
                        <span className="font-mono text-xl font-extrabold leading-none tracking-tight">{score}</span>
                        <span className="ml-0.5 font-mono text-[9px] font-bold uppercase leading-none tracking-[0.1em] opacity-80">
                          {scoreBadge(score).label}
                        </span>
                      </div>
                    </div>
                    <span className="absolute right-3 top-3 rounded-pill bg-black/65 px-2 py-1 font-mono text-xs font-bold text-white/85 backdrop-blur">
                      {formatDuration(clip.duration)}
                    </span>

                    <div className="absolute inset-0 grid place-items-center">
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
                            finalScore: score,
                          });
                        }}
                        className="grid h-[52px] w-[52px] place-items-center rounded-pill border border-white/20 bg-black/45 text-white backdrop-blur transition hover:bg-accent hover:text-[#10120A] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label="Apagar corte"
                      disabled={busy}
                      onClick={() => deleteClip(clip)}
                      className="absolute right-3 top-12 grid h-8 w-8 place-items-center rounded-pill border border-white/10 bg-black/45 text-white/70 opacity-0 backdrop-blur transition hover:bg-[rgba(255,79,90,0.3)] hover:text-[#FF8A8A] disabled:cursor-not-allowed disabled:opacity-45 group-hover:opacity-100"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />}
                    </button>

                    <div className="absolute inset-x-3 bottom-4 text-center">
                      <span
                        className="line-clamp-2 font-display text-sm font-extrabold uppercase leading-[1.15] text-white"
                        style={{ textShadow: '2px 2px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000' }}
                      >
                        {clip.hook ?? clip.title}
                      </span>
                      {clip.status === 'RENDERING' && (
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-black/65 px-2.5 py-1 text-micro font-semibold lowercase text-ink-secondary backdrop-blur">
                          <Loader2 className="h-3 w-3 animate-spin" /> renderizando
                        </span>
                      )}
                      {clip.status === 'FAILED' && (
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-black/65 px-2.5 py-1 text-micro font-semibold lowercase text-[#FF8A8A] backdrop-blur">
                          <AlertTriangle className="h-3 w-3" /> falhou
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                      <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                    </div>
                  </>
                )}
              </div>

              <div className="p-4">
                <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug tracking-tight text-ink-primary">{clip.title}</h3>
                <p className="mt-1.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-tertiary">
                  {clip.category} · {formatDuration(clip.duration)}
                </p>
                {clip.hook && <p className="mt-2 line-clamp-2 text-xs italic leading-relaxed text-ink-secondary">&ldquo;{clip.hook}&rdquo;</p>}
                {clip.status === 'FAILED' && (
                  <p className="mt-2 line-clamp-2 text-caption text-[#FF8A8A]">{clip.errorMessage ?? 'Falha ao renderizar este corte.'}</p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 px-3"
                    disabled={!canDownload || busy}
                    loading={busy && canDownload}
                    onClick={() => downloadClip(clip, index + 1)}
                  >
                    Baixar
                  </Button>
                  <Link href={`/dashboard/${clip.projectId}/editor/${clip.id}`} className="flex-1">
                    <Button type="button" size="sm" variant="secondary" className="w-full px-3">
                      Editar
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="flex-1 px-3"
                    disabled={!canDownload || busy}
                    onClick={() => setPublishClip(clip)}
                  >
                    Postar
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {publishClip && (
        <PublishDialog
          clip={publishClip}
          accounts={accounts ?? []}
          isLoadingAccounts={isLoadingAccounts}
          onClose={() => setPublishClip(null)}
          onPublished={() => {
            queryClient.invalidateQueries({ queryKey: ['published-clips'] });
          }}
        />
      )}
    </section>
  );
}
