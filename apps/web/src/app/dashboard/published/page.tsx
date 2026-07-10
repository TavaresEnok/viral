'use client';

import { useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import Link from 'next/link';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
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

const platformLabels: Record<string, string> = {
  TIKTOK: 'TikTok',
  YOUTUBE: 'YT Shorts',
  INSTAGRAM: 'Reels',
};

function statusInfo(status: string): { label: string; dotClass: string } {
  switch (status) {
    case 'PUBLISHED':
      return { label: 'Publicado', dotClass: 'bg-accent' };
    case 'PUBLISHING':
      return { label: 'Publicando', dotClass: 'bg-accent animate-pulse' };
    case 'FAILED':
      return { label: 'Falhou', dotClass: 'bg-[#FF6B6B]' };
    default:
      return { label: 'Agendado', dotClass: 'bg-[#FFC24B]' };
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
    <div className="mx-auto max-w-4xl space-y-8 px-1 py-2 md:px-4 md:py-4">
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">o que já foi pro ar</p>
        <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Postagens</h1>
        <p className="mt-2 text-body text-ink-secondary">Histórico de cortes publicados e agendados.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 rounded-card" />
      ) : !data?.length ? (
        <section className="rounded-card border border-hairline-subtle bg-surface p-10 text-center">
          <Globe className="mx-auto mb-4 h-10 w-10 text-ink-tertiary" strokeWidth={1.6} />
          <h2 className="font-display text-lg font-bold text-ink-primary">Nada postado ainda</h2>
          <p className="mx-auto mt-3 max-w-md text-body-sm text-ink-secondary">
            Posta um corte direto da tela de resultados que ele aparece aqui.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const status = statusInfo(item.status);
            const timestamp = item.publishedAt ?? item.scheduledAt ?? item.createdAt;
            return (
              <article
                key={item.id}
                className="flex items-center gap-4 rounded-[18px] border border-hairline-subtle bg-surface p-4 transition duration-150 hover:border-hairline-strong"
              >
                <div className="relative h-[74px] w-[42px] shrink-0 overflow-hidden rounded-[9px] bg-[#101016]">
                  <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
                  {item.clip.thumbnailPath && (
                    <ProtectedImage
                      src={api.clips.thumbnailUrl(item.clip.id)}
                      alt={item.clip.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] font-bold tracking-tight text-ink-primary">{item.clip.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-pill border border-hairline-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                      {platformLabels[item.socialAccount.platform] ?? item.socialAccount.platform}
                    </span>
                    {item.socialAccount.platformAccountName && (
                      <span className="truncate font-mono text-[10px] text-ink-tertiary">{item.socialAccount.platformAccountName}</span>
                    )}
                    <span className="font-mono text-[10px] text-ink-tertiary">{timeAgo(timestamp)}</span>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink-secondary">
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-pill', status.dotClass)} />
                  {status.label}
                </span>
                {item.platformPostUrl && (
                  <Link
                    href={item.platformPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-pill border border-hairline-strong px-3.5 py-1.5 text-xs font-semibold text-ink-primary transition hover:bg-elevated/60"
                  >
                    abrir ↗
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
