'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api, type ChannelImportRequest, type SocialChannelPlatform } from '@/lib/api';
import { languageOptions } from '@/lib/project-options';
import type { ClipStyle, ContentType } from '@/types/api.types';

const PLATFORM_OPTIONS: Array<{ label: string; value: SocialChannelPlatform }> = [
  { label: 'TikTok', value: 'TIKTOK' },
  { label: 'Instagram', value: 'INSTAGRAM' },
  { label: 'Kwai', value: 'KWAI' },
];

const CONTENT_TYPES: Array<{ label: string; value: ContentType }> = [
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

const CLIP_STYLES: Array<{ label: string; value: ClipStyle }> = [
  { label: 'Alta retenção', value: 'VIRAL' },
  { label: 'Educativo', value: 'EDUCATIONAL' },
  { label: 'Polêmico', value: 'CONTROVERSIAL' },
  { label: 'Engraçado', value: 'FUNNY' },
  { label: 'Motivacional', value: 'MOTIVATIONAL' },
  { label: 'Vendas', value: 'SALES' },
  { label: 'Frases fortes', value: 'STRONG_QUOTES' },
];

const STATUS_LABEL: Record<ChannelImportRequest['status'], string> = {
  PENDING: 'Na fila…',
  LISTING: 'Listando vídeos do canal…',
  READY: 'Pronto',
  FAILED: 'Falhou',
};

export default function ImportChannelPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState<SocialChannelPlatform>('TIKTOK');
  const [channelUrl, setChannelUrl] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const [contentType, setContentType] = useState<ContentType>('PODCAST');
  const [clipStyle, setClipStyle] = useState<ClipStyle>('VIRAL');
  const [language, setLanguage] = useState('pt-BR');

  const { data: request } = useQuery({
    queryKey: ['channel-import', activeRequestId],
    queryFn: () => api.channelImport.get(activeRequestId!),
    enabled: Boolean(activeRequestId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'LISTING' ? 2000 : false;
    },
  });

  const createRequest = useMutation({
    mutationFn: () => api.channelImport.create({ platform, channelUrl: channelUrl.trim() }),
    onSuccess: (created) => {
      setActiveRequestId(created.id);
      setSelectedUrls(new Set());
      queryClient.invalidateQueries({ queryKey: ['channel-import-history'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Não foi possível listar o canal.';
      toast.error(message);
    },
  });

  const importSelected = useMutation({
    mutationFn: () =>
      api.channelImport.importSelected(activeRequestId!, {
        selectedUrls: Array.from(selectedUrls),
        contentType,
        clipStyle,
        language,
      }),
    onSuccess: (result) => {
      if (result.quotaExceeded) {
        toast.warning(
          `${result.imported} de ${result.requested} vídeo(s) importados — sua quota de projetos acabou.`,
        );
      } else {
        toast.success(`${result.imported} vídeo(s) importados e enviados para processamento.`);
      }
      router.push('/dashboard');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Não foi possível importar os vídeos selecionados.';
      toast.error(message);
    },
  });

  const videos = useMemo(() => request?.videosJson ?? [], [request]);

  function toggle(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-ink-primary">Importar canal</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Cole a URL de um perfil público do TikTok, Instagram ou Kwai para listar os vídeos e escolher quais importar.
        Cada vídeo importado vira um projeto normal, processado pela IA como qualquer upload.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-40">
          <Select
            label="Plataforma"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as SocialChannelPlatform)}
            options={PLATFORM_OPTIONS}
          />
        </div>
        <div className="flex-1">
          <Input
            label="URL do canal/perfil"
            placeholder="https://www.tiktok.com/@usuario"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
          />
        </div>
        <Button
          loading={createRequest.isPending}
          disabled={!channelUrl.trim()}
          onClick={() => createRequest.mutate()}
        >
          Listar vídeos
        </Button>
      </div>

      {request && (
        <div className="mt-8">
          <p className="text-sm font-medium text-ink-secondary">{STATUS_LABEL[request.status]}</p>

          {request.status === 'FAILED' && request.errorMessage && (
            <p className="mt-2 text-sm text-danger">{request.errorMessage}</p>
          )}

          {request.status === 'READY' && (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => {
                  const checked = selectedUrls.has(video.url);
                  return (
                    <label
                      key={video.url}
                      className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition ${
                        checked ? 'border-accent bg-accent/5' : 'border-hairline-subtle bg-surface hover:border-ink-tertiary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-accent"
                        checked={checked}
                        onChange={() => toggle(video.url)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-primary">{video.title}</span>
                        {video.durationSeconds ? (
                          <span className="block text-xs text-ink-tertiary">{Math.round(video.durationSeconds)}s</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              {videos.length === 0 && (
                <p className="mt-4 text-sm text-ink-tertiary">Nenhum vídeo público encontrado nesse canal.</p>
              )}

              {videos.length > 0 && (
                <div className="mt-6 space-y-4 rounded-card border border-hairline-subtle bg-surface p-5">
                  <p className="text-sm font-semibold text-ink-primary">
                    {selectedUrls.size} vídeo(s) selecionado(s) — configure como eles serão processados:
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Select
                      label="Tipo de conteúdo"
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as ContentType)}
                      options={CONTENT_TYPES}
                    />
                    <Select
                      label="Estilo de corte"
                      value={clipStyle}
                      onChange={(e) => setClipStyle(e.target.value as ClipStyle)}
                      options={CLIP_STYLES}
                    />
                    <Select
                      label="Idioma"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      options={languageOptions}
                    />
                  </div>
                  <Button
                    loading={importSelected.isPending}
                    disabled={selectedUrls.size === 0}
                    onClick={() => importSelected.mutate()}
                  >
                    Importar {selectedUrls.size || ''} vídeo(s) selecionado(s)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
