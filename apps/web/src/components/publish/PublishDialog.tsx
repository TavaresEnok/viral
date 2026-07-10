'use client';

import { useState } from 'react';
import { CalendarClock, Globe, Loader2, Send, Settings } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import type { Clip } from '@/types/api.types';

type SocialAccount = { id: string; platform: string; platformAccountName: string | null; active: boolean };

export function PublishDialog({
  clip,
  accounts,
  isLoadingAccounts,
  onClose,
  onPublished,
}: {
  clip: Clip;
  accounts: SocialAccount[];
  isLoadingAccounts?: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    if (!selectedId) return;
    setPublishing(true);
    try {
      const scheduledAt = scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}:00` : undefined;
      await api.publish.publishClip(clip.id, selectedId, scheduledAt);
      capture(scheduledAt ? 'clip_scheduled' : 'clip_published', {
        clipId: clip.id,
        projectId: clip.projectId,
        platform: accounts.find((a) => a.id === selectedId)?.platform,
      });
      toast.success(scheduledAt ? `Publicação agendada para ${scheduleDate} às ${scheduleTime}` : 'Clip publicado com sucesso!');
      onPublished();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao publicar');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-hairline p-5">
          <h2 className="text-heading-sm text-ink-primary">Publicar</h2>
          <p className="mt-1 text-caption text-ink-tertiary">{clip.title}</p>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-micro uppercase tracking-[0.12em] text-ink-tertiary">Conta</p>
          {isLoadingAccounts ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-[60px] animate-pulse rounded-lg bg-elevated" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline-strong bg-elevated/40 p-4 text-center">
              <Globe className="mx-auto mb-2 h-7 w-7 text-ink-tertiary" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink-secondary">Nenhuma conta conectada.</p>
              <p className="mt-1 text-xs text-ink-tertiary">Conecte YouTube, TikTok ou Instagram nas configurações.</p>
              <Link
                href="/dashboard/settings"
                onClick={onClose}
                className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-accent hover:text-[color:var(--accent-text)]"
              >
                <Settings className="h-3.5 w-3.5" />
                Ir para Configurações
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  aria-label={`Selecionar conta ${account.platformAccountName ?? account.platform}`}
                  type="button"
                  disabled={!account.active}
                  onClick={() => setSelectedId(account.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                    selectedId === account.id ? 'border-accent bg-accent/10' : 'border-hairline bg-elevated hover:border-hairline-strong'
                  } ${!account.active ? 'cursor-not-allowed opacity-45' : ''}`}
                >
                  <Globe className="h-5 w-5 text-ink-secondary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-primary">{account.platformAccountName ?? account.platform}</p>
                    <p className="text-micro text-ink-tertiary">{account.platform}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="text-micro uppercase tracking-[0.12em] text-ink-tertiary">Agendar (opcional)</p>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                aria-label="Data de agendamento"
                className="flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-accent"
              />
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                aria-label="Horário de agendamento"
                className="flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-accent"
              />
            </div>
            {scheduleDate && scheduleTime && (
              <p className="mt-2 flex items-center gap-1.5 text-caption text-ink-tertiary">
                <CalendarClock className="h-3.5 w-3.5" /> Publicação agendada para {scheduleDate} às {scheduleTime}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-hairline p-5">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!selectedId || publishing} onClick={handlePublish} loading={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {scheduleDate ? 'Agendar' : 'Publicar agora'}
          </Button>
        </div>
      </div>
    </div>
  );
}
