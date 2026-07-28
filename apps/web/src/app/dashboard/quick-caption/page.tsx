'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';

export default function QuickCaptionListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const { data: batches, isLoading } = useQuery({
    queryKey: ['quick-caption-batches'],
    queryFn: api.quickCaption.listBatches,
    staleTime: 15_000,
  });

  const createBatch = useMutation({
    mutationFn: () => api.quickCaption.createBatch({ name: name.trim() || undefined }),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['quick-caption-batches'] });
      setCreating(false);
      setName('');
      router.push(`/dashboard/quick-caption/${batch.id}`);
    },
    onError: () => toast.error('Não foi possível criar o lote.'),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Editor em massa</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Suba vários vídeos, digite a legenda de cada um e renderize tudo de uma vez — sem passar por IA.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Novo lote
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-ink-tertiary">Carregando…</p>}
        {!isLoading && batches?.length === 0 && (
          <p className="col-span-full text-sm text-ink-tertiary">
            Nenhum lote ainda. Crie o primeiro para começar a legendar vídeos em massa.
          </p>
        )}
        {batches?.map((batch) => (
          <Link
            key={batch.id}
            href={`/dashboard/quick-caption/${batch.id}`}
            className="block rounded-card border border-hairline-subtle bg-surface p-5 transition hover:border-ink-tertiary"
          >
            <p className="truncate text-sm font-semibold text-ink-primary">{batch.name}</p>
            <p className="mt-1 text-xs text-ink-tertiary">
              {batch._count?.items ?? 0} vídeo(s) · {batch.renderLayout} · {batch.captionTheme}
            </p>
          </Link>
        ))}
      </div>

      <Modal open={creating} onOpenChange={setCreating} title="Novo lote">
        <div className="space-y-4">
          <Input
            label="Nome do lote"
            placeholder="Ex.: Cortes da semana"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Button
            className="w-full"
            loading={createBatch.isPending}
            onClick={() => createBatch.mutate()}
          >
            Criar e continuar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
