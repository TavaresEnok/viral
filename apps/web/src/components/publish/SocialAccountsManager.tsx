'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';

type SocialAccount = {
  id: string;
  platform: string;
  platformAccountName: string | null;
  active: boolean;
  createdAt: string;
};

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z" />
  </svg>
);

const InstagramIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const platformMeta: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  YOUTUBE: {
    label: 'YouTube',
    color: 'text-[#FF4444]',
    bg: 'bg-[rgba(255,68,68,0.08)] border-[rgba(255,68,68,0.2)]',
    icon: <Youtube className="h-5 w-5" />,
  },
  TIKTOK: {
    label: 'TikTok',
    color: 'text-ink-primary',
    bg: 'bg-elevated border-hairline-strong',
    icon: <TikTokIcon />,
  },
  INSTAGRAM: {
    label: 'Instagram (Reels)',
    color: 'text-[#E1306C]',
    bg: 'bg-[rgba(225,48,108,0.08)] border-[rgba(225,48,108,0.2)]',
    icon: <InstagramIcon />,
  },
};

function ConnectedAccount({ account, onDisconnect }: { account: SocialAccount; onDisconnect: () => void }) {
  const meta = platformMeta[account.platform];
  const [busy, setBusy] = useState(false);

  async function handleDisconnect() {
    const ok = window.confirm(
      `Desconectar a conta "${account.platformAccountName ?? account.platform}"? Você precisará conectar novamente para publicar.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.publish.disconnectAccount(account.id);
      onDisconnect();
      toast.success('Conta desconectada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao desconectar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-4 transition', meta?.bg ?? 'bg-elevated border-hairline-strong')}>
      <span className={cn('shrink-0', meta?.color ?? 'text-ink-tertiary')}>
        {meta?.icon ?? <ExternalLink className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-primary">
          {account.platformAccountName ?? meta?.label ?? account.platform}
        </p>
        <p className="text-xs text-ink-tertiary">
          {meta?.label ?? account.platform} &middot; conectado {timeAgo(account.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {account.active ? (
          <span className="flex items-center gap-1 rounded-pill bg-[rgba(200,245,66,0.12)] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent-text)]">
            <CheckCircle2 className="h-3 w-3" />
            Ativo
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-pill bg-[rgba(255,107,107,0.12)] px-2.5 py-1 text-xs font-semibold text-[#FF8A8A]">
            <RefreshCw className="h-3 w-3" />
            Expirado
          </span>
        )}

        <button
          type="button"
          aria-label={`Desconectar ${account.platformAccountName ?? account.platform}`}
          disabled={busy}
          onClick={handleDisconnect}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-tertiary transition hover:bg-[rgba(255,79,90,0.15)] hover:text-[#FF8A8A] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function SocialAccountsManager() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['publish-accounts'],
    queryFn: () => api.publish.accounts() as Promise<SocialAccount[]>,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['publish-accounts'] });
  }

  const [connecting, setConnecting] = useState<string | null>(null);

  async function connect(platform: 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM') {
    setConnecting(platform);
    try {
      const { url } =
        platform === 'YOUTUBE'
          ? await api.publish.youtubeAuthUrl()
          : platform === 'TIKTOK'
            ? await api.publish.tiktokAuthUrl()
            : await api.publish.instagramAuthUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao iniciar conexão');
      setConnecting(null);
    }
  }

  const connected = accounts ?? [];
  const hasYouTube = connected.some((a) => a.platform === 'YOUTUBE');
  const hasTikTok = connected.some((a) => a.platform === 'TIKTOK');
  const hasInstagram = connected.some((a) => a.platform === 'INSTAGRAM');

  return (
    <section className="space-y-5 rounded-card border border-hairline-subtle bg-surface p-6 shadow-elevated">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
          Contas Sociais
        </h2>
        <p className="mt-1 text-xs text-ink-tertiary">
          Conecte suas contas para publicar cortes diretamente pelo ViralForge.
        </p>
      </div>

      {/* Contas conectadas */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : connected.length > 0 ? (
        <div className="space-y-3">
          {connected.map((account) => (
            <ConnectedAccount key={account.id} account={account} onDisconnect={invalidate} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-hairline-strong py-8 text-center">
          <p className="text-sm text-ink-tertiary">Nenhuma conta conectada ainda.</p>
        </div>
      )}

      {/* Conectar plataformas */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-tertiary">
          Conectar plataforma
        </p>
        <div className="flex flex-wrap gap-3">
          {/* YouTube */}
          <button
            id="connect-youtube-btn"
            type="button"
            onClick={() => connect('YOUTUBE')}
            disabled={hasYouTube || connecting !== null}
            title={hasYouTube ? 'YouTube já conectado' : 'Conectar YouTube'}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
              hasYouTube
                ? 'cursor-not-allowed border-hairline-subtle text-ink-tertiary'
                : 'border-[rgba(255,68,68,0.3)] bg-[rgba(255,68,68,0.08)] text-[#FF6666] hover:bg-[rgba(255,68,68,0.15)]',
            )}
          >
            {connecting === 'YOUTUBE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
            {hasYouTube ? 'YouTube conectado' : 'Conectar YouTube'}
          </button>

          {/* TikTok */}
          <button
            type="button"
            onClick={() => connect('TIKTOK')}
            disabled={hasTikTok || connecting !== null}
            title={hasTikTok ? 'TikTok já conectado' : 'Conectar TikTok'}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
              hasTikTok
                ? 'cursor-not-allowed border-hairline-subtle text-ink-tertiary'
                : 'border-hairline-strong bg-elevated text-ink-primary hover:border-ink-tertiary',
            )}
          >
            {connecting === 'TIKTOK' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TikTokIcon />}
            {hasTikTok ? 'TikTok conectado' : 'Conectar TikTok'}
          </button>

          {/* Instagram */}
          <button
            type="button"
            onClick={() => connect('INSTAGRAM')}
            disabled={hasInstagram || connecting !== null}
            title={hasInstagram ? 'Instagram já conectado' : 'Conectar Instagram'}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
              hasInstagram
                ? 'cursor-not-allowed border-hairline-subtle text-ink-tertiary'
                : 'border-[rgba(225,48,108,0.3)] bg-[rgba(225,48,108,0.08)] text-[#E1306C] hover:bg-[rgba(225,48,108,0.15)]',
            )}
          >
            {connecting === 'INSTAGRAM' ? <Loader2 className="h-4 w-4 animate-spin" /> : <InstagramIcon />}
            {hasInstagram ? 'Instagram conectado' : 'Conectar Instagram'}
          </button>
        </div>

        <p className="mt-3 text-xs text-ink-tertiary">
          Conecte pelo login da própria plataforma — seguro, o ViralForge não vê sua senha.
        </p>
      </div>
    </section>
  );
}
