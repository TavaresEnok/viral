'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration, timeAgo } from '@/lib/format';
import type { Project } from '@/types/api.types';
import { StatusBadge } from './StatusBadge';

const placeholderGradients = [
  'linear-gradient(135deg, #15201A, #0C0C11 60%, #1A2410)',
  'linear-gradient(135deg, #161620, #0C0C11 55%, #20141C)',
  'linear-gradient(135deg, #1C2014, #0C0C11 60%, #141B20)',
  'linear-gradient(135deg, #201A14, #0C0C11 55%, #14201E)',
];

function projectGradient(indexSeed: string) {
  const index = indexSeed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % placeholderGradients.length;
  return placeholderGradients[index];
}

export function ProjectCard({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const bestClip = project.clips?.[0];
  const clipCount = project._count?.clips ?? project.clips?.length ?? 0;
  const score = bestClip ? bestClip.finalScore || bestClip.viralScore : null;
  const processing = project.status === 'PROCESSING' || project.status === 'PENDING';

  async function deleteProject(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm(`Apagar o vídeo "${project.title}" e todos os cortes dele? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.projects.remove(project.id);
      capture('project_deleted', { projectId: project.id, status: project.status, clipCount });
      queryClient.removeQueries({ queryKey: ['project', project.id] });
      queryClient.removeQueries({ queryKey: ['clips', project.id] });
      queryClient.setQueryData<Project[]>(['projects'], (current) => current?.filter((item) => item.id !== project.id) ?? current);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Vídeo apagado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao apagar vídeo');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="group block overflow-hidden rounded-card border border-hairline-subtle bg-surface transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-video overflow-hidden" style={{ background: projectGradient(project.id) }}>
        <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
        {bestClip?.thumbnailPath && (
          <ProtectedImage
            src={api.clips.thumbnailUrl(bestClip.id)}
            alt={project.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-reveal group-hover:scale-[1.025]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <div className="absolute left-3 top-3">
          <StatusBadge status={project.status} />
        </div>
        <button
          type="button"
          onClick={deleteProject}
          disabled={deleting}
          aria-label={`Apagar vídeo ${project.title}`}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-pill border border-white/10 bg-black/45 text-white/70 opacity-0 backdrop-blur transition hover:border-[rgba(255,79,90,0.5)] hover:bg-[rgba(255,79,90,0.25)] hover:text-[#FF8A8A] disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={1.6} />}
        </button>
        {project.status === 'FAILED' && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 text-[#FF8A8A]">
            <AlertTriangle className="h-8 w-8" strokeWidth={1.6} />
          </div>
        )}
        <span className="absolute bottom-3 right-3 rounded-pill bg-black/60 px-2 py-1 font-mono text-xs font-bold text-white/85 backdrop-blur">
          {formatDuration(project.durationSeconds)}
        </span>
        {processing && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/45">
            <div className="h-full bg-progress-viral transition-[width] duration-500" style={{ width: `${project.progress ?? 0}%` }} />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-[2.6rem] font-display text-base font-bold leading-snug tracking-tight text-ink-primary">
            {project.title}
          </h3>
          {score !== null && (
            <span
              className={cn(
                'shrink-0 rounded-pill border border-hairline-subtle px-2 py-0.5 font-mono text-caption font-bold',
                score >= 90 ? 'text-[color:var(--accent-text)]' : 'text-ink-secondary',
              )}
            >
              ▲ {score}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-tertiary">
          {project.contentType} · {project.language}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-ink-secondary">
            {processing ? 'cortando…' : `${clipCount} ${clipCount === 1 ? 'corte pronto' : 'cortes prontos'}`}
          </span>
          <span className="font-mono text-micro text-ink-tertiary">{timeAgo(project.updatedAt ?? project.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
