'use client';

import { useCallback, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { api, type QuickCaptionItem } from '@/lib/api';
import { captionThemeSelectOptions, availableRenderLayoutOptions } from '@/lib/project-options';

const STATUS_LABEL: Record<QuickCaptionItem['status'], string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Na fila',
  RENDERING: 'Renderizando…',
  COMPLETED: 'Pronto',
  FAILED: 'Falhou',
};

const STATUS_COLOR: Record<QuickCaptionItem['status'], string> = {
  DRAFT: 'text-ink-tertiary',
  PENDING: 'text-warning',
  RENDERING: 'text-warning',
  COMPLETED: 'text-success',
  FAILED: 'text-danger',
};

function ItemCard({
  item,
  onCaptionChange,
  onDelete,
}: {
  item: QuickCaptionItem;
  onCaptionChange: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(item.captionText);
  const locked = item.status === 'RENDERING' || item.status === 'PENDING';

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline-subtle bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</p>
          {item.durationSeconds ? (
            <p className="text-xs text-ink-tertiary">{Math.round(item.durationSeconds)}s</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={locked}
          aria-label="Remover item"
          className="rounded-input p-1.5 text-ink-tertiary transition hover:bg-elevated hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>

      <textarea
        className="min-h-[80px] w-full resize-none rounded-input border border-hairline-subtle bg-elevated/40 px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
        placeholder="Digite a legenda deste vídeo…"
        value={draft}
        disabled={locked}
        maxLength={500}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== item.captionText) onCaptionChange(draft);
        }}
      />

      {item.status === 'FAILED' && item.errorMessage && (
        <p className="text-xs text-danger">{item.errorMessage}</p>
      )}

      {item.status === 'COMPLETED' && (
        <a
          href={api.quickCaption.downloadUrl(item.id)}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-accent hover:underline"
        >
          Baixar vídeo renderizado
        </a>
      )}
    </div>
  );
}

export default function QuickCaptionBatchPage() {
  const params = useParams<{ id: string }>();
  const batchId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: batch, isLoading } = useQuery({
    queryKey: ['quick-caption-batch', batchId],
    queryFn: () => api.quickCaption.getBatch(batchId),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const active = items.some((item) => item.status === 'PENDING' || item.status === 'RENDERING');
      return active ? 3000 : false;
    },
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['quick-caption-batch', batchId] }),
    [queryClient, batchId],
  );

  const updateBatchSettings = useMutation({
    mutationFn: (data: { renderLayout?: string; captionTheme?: string }) =>
      api.quickCaption.updateBatch(batchId, data as never),
    onSuccess: invalidate,
  });

  const updateCaption = useMutation({
    mutationFn: ({ itemId, captionText }: { itemId: string; captionText: string }) =>
      api.quickCaption.updateItem(itemId, captionText),
    onSuccess: invalidate,
    onError: () => toast.error('Não foi possível salvar a legenda.'),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.quickCaption.deleteItem(itemId),
    onSuccess: invalidate,
  });

  const deleteBatch = useMutation({
    mutationFn: () => api.quickCaption.deleteBatch(batchId),
    onSuccess: () => router.push('/dashboard/quick-caption'),
  });

  const renderBatch = useMutation({
    mutationFn: () => api.quickCaption.renderBatch(batchId),
    onSuccess: (result) => {
      toast.success(`${result.queued} vídeo(s) enviados para renderizar.`);
      invalidate();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Não foi possível renderizar o lote.';
      toast.error(message);
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          await api.quickCaption.uploadItem(batchId, file, () => undefined);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha no upload';
          toast.error(`${file.name}: ${message}`);
        }
      }
      invalidate();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (isLoading || !batch) {
    return <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink-tertiary">Carregando…</div>;
  }

  const readyToRender = (batch.items ?? []).filter(
    (item) => item.originalFilePath && item.captionText.trim().length > 0 && item.status !== 'RENDERING',
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <button
        type="button"
        onClick={() => router.push('/dashboard/quick-caption')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink-primary"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        Todos os lotes
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">{batch.name}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {(batch.items ?? []).length} vídeo(s) · legenda digitada por item, estilo compartilhado entre todos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (confirm('Apagar este lote e todos os vídeos dele?')) deleteBatch.mutate();
            }}
          >
            Excluir lote
          </Button>
          <Button
            loading={renderBatch.isPending}
            disabled={readyToRender === 0}
            onClick={() => renderBatch.mutate()}
          >
            Renderizar tudo ({readyToRender})
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Layout compartilhado"
          value={batch.renderLayout}
          onChange={(e) => updateBatchSettings.mutate({ renderLayout: e.target.value })}
          options={availableRenderLayoutOptions.map((o) => ({ label: o.label, value: o.value }))}
        />
        <Select
          label="Estilo de legenda compartilhado"
          value={batch.captionTheme}
          onChange={(e) => updateBatchSettings.mutate({ captionTheme: e.target.value })}
          options={captionThemeSelectOptions}
        />
      </div>

      <div className="mt-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-hairline-strong bg-surface py-8 text-sm font-medium text-ink-secondary transition hover:border-accent hover:text-ink-primary disabled:opacity-60"
        >
          <Upload className="h-4 w-4" strokeWidth={1.8} />
          {uploading ? 'Enviando vídeos…' : 'Adicionar vídeos (selecione vários de uma vez)'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(batch.items ?? []).map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onCaptionChange={(text) => updateCaption.mutate({ itemId: item.id, captionText: text })}
            onDelete={() => deleteItem.mutate(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
