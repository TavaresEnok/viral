'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Globe, List, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ProtectedImage } from '@/components/common/ProtectedImage';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api, type PublishedClip } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';

const platformLabels: Record<string, string> = { TIKTOK: 'TikTok', YOUTUBE: 'YT Shorts', INSTAGRAM: 'Reels' };
const weekDays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function statusInfo(status: string): { label: string; dotClass: string } {
  switch (status) {
    case 'PUBLISHED': return { label: 'Publicado', dotClass: 'bg-accent' };
    case 'PUBLISHING': return { label: 'Publicando', dotClass: 'bg-accent animate-pulse' };
    case 'FAILED': return { label: 'Falhou', dotClass: 'bg-danger' };
    default: return { label: 'Agendado', dotClass: 'bg-warning' };
  }
}

function itemDate(item: PublishedClip): Date {
  return new Date(item.scheduledAt ?? item.publishedAt ?? item.createdAt);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthInterval(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);
  return { start: gridStart.toISOString(), end: gridEnd.toISOString(), gridStart };
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function PostingCard({ item, compact = false, onManage }: { item: PublishedClip; compact?: boolean; onManage: (item: PublishedClip) => void }) {
  const status = statusInfo(item.status);
  const timestamp = item.publishedAt ?? item.scheduledAt ?? item.createdAt;
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onManage(item)}
        className="block w-full truncate rounded-lg border border-hairline-subtle bg-elevated/70 px-2 py-1.5 text-left text-[11px] font-semibold text-ink-primary transition hover:border-hairline-strong hover:bg-overlay"
        title={item.clip.title}
      >
        <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-pill', status.dotClass)} />
        {new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {item.clip.title}
      </button>
    );
  }
  return (
    <article className="flex items-center gap-4 rounded-[18px] border border-hairline-subtle bg-surface p-4 transition hover:border-hairline-strong">
      <div className="relative h-[74px] w-[42px] shrink-0 overflow-hidden rounded-[9px] bg-[#101016]">
        <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
        {item.clip.thumbnailPath && <ProtectedImage src={api.clips.thumbnailUrl(item.clip.id)} alt={item.clip.title} className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-bold tracking-tight text-ink-primary">{item.clip.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-pill border border-hairline-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">{platformLabels[item.socialAccount.platform] ?? item.socialAccount.platform}</span>
          {item.socialAccount.platformAccountName && <span className="truncate font-mono text-[10px] text-ink-tertiary">{item.socialAccount.platformAccountName}</span>}
          <span className="font-mono text-[10px] text-ink-tertiary">{timeAgo(timestamp)}</span>
        </div>
      </div>
      <span className="hidden shrink-0 items-center gap-2 text-xs font-semibold text-ink-secondary sm:flex">
        <span aria-hidden="true" className={cn('h-2 w-2 rounded-pill', status.dotClass)} />{status.label}
      </span>
      {item.status === 'PENDING' && item.scheduledAt ? (
        <Button size="sm" variant="secondary" onClick={() => onManage(item)}>gerenciar</Button>
      ) : item.platformPostUrl ? (
        <Link href={item.platformPostUrl} target="_blank" rel="noopener noreferrer" className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-hairline-strong text-ink-primary transition hover:bg-elevated" aria-label="Abrir postagem">
          <ExternalLink className="h-4 w-4" />
        </Link>
      ) : null}
    </article>
  );
}

export default function PublishedPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');
  const [selected, setSelected] = useState<PublishedClip | null>(null);
  const [newSchedule, setNewSchedule] = useState('');
  const interval = useMemo(() => monthInterval(month), [month]);

  const { data = [], isLoading } = useQuery({
    queryKey: ['publish-calendar', interval.start, interval.end, status, platform],
    queryFn: () => api.publish.calendar({ from: interval.start, to: interval.end, status: status || undefined, platform: platform || undefined }),
    staleTime: 20_000,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['publish-calendar'] }),
      queryClient.invalidateQueries({ queryKey: ['published-clips'] }),
    ]);
  };
  const reschedule = useMutation({
    mutationFn: () => api.publish.reschedule(selected!.id, new Date(newSchedule).toISOString()),
    onSuccess: async () => { toast.success('Publicação reagendada'); setSelected(null); await refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível reagendar'),
  });
  const cancel = useMutation({
    mutationFn: () => api.publish.cancelScheduled(selected!.id),
    onSuccess: async () => { toast.success('Agendamento cancelado'); setSelected(null); await refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar'),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, PublishedClip[]>();
    for (const item of data) map.set(dayKey(itemDate(item)), [...(map.get(dayKey(itemDate(item))) ?? []), item]);
    return map;
  }, [data]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, index) => {
    const date = new Date(interval.gridStart);
    date.setDate(date.getDate() + index);
    return date;
  }), [interval.gridStart]);

  const openManage = (item: PublishedClip) => {
    if (item.status === 'PENDING' && item.scheduledAt) {
      setSelected(item);
      setNewSchedule(toDateTimeLocal(item.scheduledAt));
    } else if (item.platformPostUrl) {
      window.open(item.platformPostUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 py-2 md:px-4 md:py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">planejar · publicar · acompanhar</p>
          <h1 className="mt-3 font-display text-display-md font-extrabold text-ink-primary">Calendário social</h1>
          <p className="mt-2 text-body text-ink-secondary">Organize os cortes publicados e agendados em todas as suas redes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-pill border border-hairline-subtle bg-surface px-3 text-xs text-ink-primary outline-none focus:border-accent">
            <option value="">Todos os status</option><option value="PENDING">Agendados</option><option value="PUBLISHED">Publicados</option><option value="FAILED">Falhas</option>
          </select>
          <select aria-label="Filtrar por plataforma" value={platform} onChange={(event) => setPlatform(event.target.value)} className="h-9 rounded-pill border border-hairline-subtle bg-surface px-3 text-xs text-ink-primary outline-none focus:border-accent">
            <option value="">Todas as redes</option><option value="YOUTUBE">YouTube</option><option value="TIKTOK">TikTok</option><option value="INSTAGRAM">Instagram</option>
          </select>
          <div className="flex rounded-pill border border-hairline-subtle bg-surface p-1">
            <button type="button" aria-label="Visualização em calendário" onClick={() => setView('calendar')} className={cn('grid h-7 w-8 place-items-center rounded-pill', view === 'calendar' ? 'bg-elevated text-ink-primary' : 'text-ink-tertiary')}><CalendarDays className="h-4 w-4" /></button>
            <button type="button" aria-label="Visualização em lista" onClick={() => setView('list')} className={cn('grid h-7 w-8 place-items-center rounded-pill', view === 'list' ? 'bg-elevated text-ink-primary' : 'text-ink-tertiary')}><List className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-card border border-hairline-subtle bg-surface">
        <div className="flex items-center justify-between border-b border-hairline-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-pill text-ink-secondary hover:bg-elevated" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setMonth(new Date())} className="rounded-pill px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-elevated">hoje</button>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-pill text-ink-secondary hover:bg-elevated" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <h2 className="font-display text-base font-bold capitalize text-ink-primary">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
          <span className="font-mono text-[10px] text-ink-tertiary">{data.length} postagens</span>
        </div>

        {isLoading ? <div className="p-4"><Skeleton className="h-[520px] rounded-card" /></div> : !data.length ? (
          <div className="p-12 text-center"><Globe className="mx-auto mb-4 h-10 w-10 text-ink-tertiary" strokeWidth={1.6} /><h2 className="font-display text-lg font-bold text-ink-primary">Nenhuma postagem neste período</h2><p className="mt-2 text-body-sm text-ink-secondary">Agende um corte na tela de resultados para preencher o calendário.</p></div>
        ) : view === 'list' ? (
          <div className="space-y-3 p-4">{[...data].sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime()).map((item) => <PostingCard key={item.id} item={item} onManage={openManage} />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-7 border-b border-hairline-subtle">{weekDays.map((day) => <div key={day} className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">{day}</div>)}</div>
              <div className="grid grid-cols-7">{days.map((date) => {
                const entries = byDay.get(dayKey(date)) ?? [];
                const currentMonth = date.getMonth() === month.getMonth();
                const today = dayKey(date) === dayKey(new Date());
                return <div key={dayKey(date)} className={cn('min-h-28 border-b border-r border-hairline-subtle p-2', !currentMonth && 'bg-base/30')}>
                  <div className={cn('mb-2 grid h-6 w-6 place-items-center rounded-pill font-mono text-[10px]', today ? 'bg-accent font-bold text-[#10120A]' : currentMonth ? 'text-ink-secondary' : 'text-ink-tertiary')}>{date.getDate()}</div>
                  <div className="space-y-1">{entries.slice(0, 3).map((item) => <PostingCard key={item.id} item={item} compact onManage={openManage} />)}{entries.length > 3 && <p className="px-1 text-[10px] text-ink-tertiary">+{entries.length - 3} postagens</p>}</div>
                </div>;
              })}</div>
            </div>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Gerenciar agendamento"
        description={selected ? `${selected.clip.title} · ${platformLabels[selected.platform] ?? selected.platform}` : undefined}
        className="max-w-lg"
        footer={<><Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}><Trash2 className="h-4 w-4" />Cancelar</Button><Button onClick={() => reschedule.mutate()} loading={reschedule.isPending} disabled={!newSchedule || new Date(newSchedule) <= new Date()}>Salvar nova data</Button></>}
      >
        <label className="block space-y-2 text-sm text-ink-secondary">
          <span className="font-medium">Nova data e horário</span>
          <input type="datetime-local" value={newSchedule} min={toDateTimeLocal(new Date(Date.now() + 60_000).toISOString())} onChange={(event) => setNewSchedule(event.target.value)} className="h-12 w-full rounded-input border border-hairline-subtle bg-surface px-4 text-sm text-ink-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
          <span className="block text-xs text-ink-tertiary">O horário usa o fuso configurado no seu dispositivo.</span>
        </label>
      </Modal>
    </div>
  );
}
