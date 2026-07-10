'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Clock, ExternalLink, Globe, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

type PublishedClip = {
  id: string;
  status: string;
  platformPostUrl: string | null;
  platformPostId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  clip: { id: string; title: string; duration: number; thumbnailPath: string | null };
  socialAccount: { platform: string; platformAccountName: string | null };
};

function statusIcon(status: string) {
  switch (status) {
    case 'PUBLISHED': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case 'PUBLISHING': return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case 'FAILED': return <XCircle className="h-4 w-4 text-red-400" />;
    default: return <Clock className="h-4 w-4 text-yellow-400" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'PUBLISHED': return 'Publicado';
    case 'PUBLISHING': return 'Publicando';
    case 'FAILED': return 'Falhou';
    default: return 'Na fila';
  }
}

export default function PublishedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['published-clips'],
    queryFn: () => api.publish.publishedClips() as Promise<PublishedClip[]>,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-display-md text-ink-primary">Publicações</h1>
        <p className="mt-2 text-body text-ink-secondary">Histórico de clips publicados e agendados.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : !data?.length ? (
        <section className="rounded-2xl border border-hairline bg-surface p-10 text-center">
          <Globe className="mx-auto mb-4 h-10 w-10 text-ink-tertiary" />
          <h2 className="text-heading-sm text-ink-primary">Nenhuma publicação</h2>
          <p className="mx-auto mt-3 max-w-md text-body-sm text-ink-secondary">
            Publique um clip diretamente pelo dashboard do projeto para vê-lo aqui.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <article key={item.id} className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4 transition hover:border-hairline-strong">
              {item.clip.thumbnailPath ? (
                <ProtectedImage src={api.clips.thumbnailUrl(item.clip.id)} alt={item.clip.title} className="h-16 w-9 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-9 shrink-0 rounded-lg bg-elevated" />
              )}
              <div className="flex-1 min-w-0">
                <Link href={`/dashboard/${item.clip.id.split('-')[0] ?? ''}/editor/${item.clip.id}`} className="text-sm font-medium text-ink-primary transition hover:text-accent truncate block">
                  {item.clip.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-caption text-ink-tertiary">
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {item.socialAccount.platformAccountName ?? item.socialAccount.platform}</span>
                  <span className="flex items-center gap-1">{statusIcon(item.status)} {statusLabel(item.status)}</span>
                  {item.scheduledAt && !item.publishedAt && (
                    <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Agendado {timeAgo(item.scheduledAt)}</span>
                  )}
                  {item.publishedAt && <span className="text-ink-quaternary">Publicado {timeAgo(item.publishedAt)}</span>}
                </div>
              </div>
              {item.platformPostUrl && (
                <Link href={item.platformPostUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir no YouTube">
                  <ExternalLink className="h-4 w-4 text-ink-tertiary transition hover:text-ink-primary" />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
