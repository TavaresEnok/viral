'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Film, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration, timeAgo } from '@/lib/format';
import type { Project } from '@/types/api.types';
import { StatusBadge } from './StatusBadge';

function projectGradient(indexSeed: string) {
  const gradients = [
    'from-teal-950 via-zinc-950 to-emerald-950',
    'from-zinc-900 via-neutral-950 to-blue-950',
    'from-stone-900 via-zinc-950 to-teal-950',
    'from-slate-950 via-zinc-950 to-amber-950',
  ];
  const index = indexSeed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % gradients.length;
  return gradients[index];
}

export function ProjectCard({ project, view = 'grid' }: { project: Project; view?: 'grid' | 'list' }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const bestClip = project.clips?.[0];
  const clipCount = project._count?.clips ?? project.clips?.length ?? 0;
  const score = bestClip ? bestClip.finalScore || bestClip.viralScore : null;

  async function deleteProject(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm(`Apagar o projeto "${project.title}" e todos os cortes dele? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.projects.remove(project.id);
      capture('project_deleted', { projectId: project.id, status: project.status, clipCount });
      queryClient.removeQueries({ queryKey: ['project', project.id] });
      queryClient.removeQueries({ queryKey: ['clips', project.id] });
      queryClient.setQueryData<Project[]>(['projects'], (current) => current?.filter((item) => item.id !== project.id) ?? current);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto apagado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao apagar projeto');
    } finally {
      setDeleting(false);
    }
  }

  if (view === 'list') {
    return (
      <Link
        href={`/dashboard/${project.id}`}
        className="grid gap-4 border-b border-hairline-subtle px-5 py-4 transition hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:grid-cols-[minmax(0,1fr)_110px_110px_130px]"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className={cn('relative h-14 w-24 shrink-0 overflow-hidden rounded-md border border-hairline-subtle bg-gradient-to-br', projectGradient(project.id))}>
            {bestClip?.thumbnailPath ? <ProtectedImage src={api.clips.thumbnailUrl(bestClip.id)} alt={project.title} className="h-full w-full object-cover" /> : <Film className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white/55" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-primary">{project.title}</p>
            <p className="mt-1 truncate text-xs text-ink-tertiary">{project.language} · {project.contentType} · {timeAgo(project.createdAt)}</p>
          </div>
        </div>
        <div className="text-sm md:text-right">
          <p className="font-mono text-ink-primary">{formatDuration(project.durationSeconds)}</p>
          <p className="text-xs text-ink-tertiary">duração</p>
        </div>
        <div className="text-sm md:text-right">
          <p className="font-mono text-ink-primary">{clipCount}</p>
          <p className="text-xs text-ink-tertiary">cortes</p>
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <StatusBadge status={project.status} />
          <button
            type="button"
            onClick={deleteProject}
            disabled={deleting}
            aria-label={`Apagar projeto ${project.title}`}
            className="grid h-8 w-8 place-items-center rounded-md border border-hairline-subtle text-ink-tertiary transition hover:border-red-400/40 hover:bg-danger/15 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="group block overflow-hidden rounded-lg border border-hairline-subtle bg-surface transition-colors duration-200 hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className={cn('relative aspect-video overflow-hidden bg-gradient-to-br', projectGradient(project.id))}>
        {bestClip?.thumbnailPath ? (
          <ProtectedImage src={api.clips.thumbnailUrl(bestClip.id)} alt={project.title} className="h-full w-full object-cover opacity-88 transition duration-700 ease-reveal group-hover:scale-[1.025]" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,.14),transparent_16rem)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base/90 via-base/15 to-transparent" />
        <div className="absolute left-3 top-3"><StatusBadge status={project.status} /></div>
        <button
          type="button"
          onClick={deleteProject}
          disabled={deleting}
          aria-label={`Apagar projeto ${project.title}`}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-black/45 text-white/70 opacity-0 backdrop-blur transition hover:border-red-300/50 hover:bg-red-950/70 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
        {project.status === 'PROCESSING' && (
          <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[2px]">
            <ProgressRing value={project.progress} size={58} />
          </div>
        )}
        {project.status === 'FAILED' && (
          <div className="absolute inset-0 grid place-items-center bg-red-950/60 text-red-200">
            <AlertTriangle className="h-8 w-8" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <span className="rounded bg-black/55 px-2 py-1 font-mono text-xs text-white/80 backdrop-blur">{formatDuration(project.durationSeconds)}</span>
          {score !== null && <span className="rounded-full border border-accent/35 bg-black/55 px-2 py-1 font-mono text-xs text-teal-100 backdrop-blur">score {score}</span>}
        </div>
      </div>
      <div className="p-5">
        <h3 className="line-clamp-2 min-h-[2.8rem] text-lg font-medium leading-snug text-ink-primary">{project.title}</h3>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-tertiary">
          <span>{project.contentType}</span>
          <span className="font-mono">{timeAgo(project.updatedAt ?? project.createdAt)}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-tertiary">
          <span>{clipCount} momentos pontuados</span>
          <span>{project.language}</span>
        </div>
      </div>
    </Link>
  );
}
