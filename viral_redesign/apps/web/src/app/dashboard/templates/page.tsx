'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

const THEMES = ['CLEAN_FOOTER', 'BOLD_FOOTER', 'CREATOR_BOX', 'MINIMAL', 'BOLD_CREATOR', 'CLEAN_EDITORIAL', 'NEON_TECH', 'KARAOKE_PRO', 'PODCAST_PRO', 'STORY_IMPACT'];
const LAYOUTS = ['BLURRED_BACKGROUND', 'FILL_CROP', 'CENTER_FIT', 'TOP_FRAME', 'SMART_REFRAME'];

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', captionTheme: 'CLEAN_FOOTER', renderLayout: 'BLURRED_BACKGROUND' });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['caption-templates'],
    queryFn: () => api.captionTemplates.list(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; captionTheme: string; renderLayout: string }) => api.captionTemplates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-templates'] });
      setShowForm(false);
      setForm({ name: '', captionTheme: 'CLEAN_FOOTER', renderLayout: 'BLURRED_BACKGROUND' });
      toast.success('Template criado');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao criar template'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.captionTemplates.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caption-templates'] });
      toast.success('Template removido');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao remover'),
  });

  return (
    <div className="mx-auto max-w-[1400px] px-1 py-2 md:px-4 md:py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Personalização</p>
          <h1 className="mt-3 text-4xl font-semibold text-ink-primary md:text-5xl">Templates</h1>
          <p className="mt-2 text-sm text-ink-secondary">Crie templates de estilo para reutilizar em seus projetos.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" /> Novo template
        </Button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-lg border border-hairline-subtle bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink-primary">Criar template</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="template-name-input" className="text-xs font-medium text-ink-secondary">Nome</label>
              <input
                id="template-name-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Meu template"
                className="mt-1 w-full rounded-md border border-hairline-subtle bg-base px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-ink-secondary">Tema de legenda</label>
                <select
                  value={form.captionTheme}
                  onChange={(e) => setForm({ ...form, captionTheme: e.target.value })}
                  className="mt-1 w-full rounded-md border border-hairline-subtle bg-base px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
                >
                  {THEMES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-ink-secondary">Layout</label>
                <select
                  value={form.renderLayout}
                  onChange={(e) => setForm({ ...form, renderLayout: e.target.value })}
                  className="mt-1 w-full rounded-md border border-hairline-subtle bg-base px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
                >
                  {LAYOUTS.map((l) => (
                    <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate(form)} loading={createMutation.isPending}>Salvar</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className="rounded-lg border border-hairline-subtle bg-surface p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-ink-primary">{tpl.name}</h3>
                <p className="mt-1 text-xs text-ink-tertiary">{tpl.captionTheme.replace(/_/g, ' ')} · {tpl.renderLayout.replace(/_/g, ' ')}</p>
              </div>
              <Button variant="ghost" aria-label="Apagar template" onClick={() => removeMutation.mutate(tpl.id)}>
                <Trash2 className="h-3 w-3 text-signal-danger" />
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">{tpl.captionTheme.replace(/_/g, ' ')}</span>
              <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">{tpl.renderLayout.replace(/_/g, ' ')}</span>
            </div>
          </div>
        ))}
        {!isLoading && templates.length === 0 && (
          <p className="col-span-full text-center text-sm text-ink-tertiary py-12">Nenhum template ainda. Crie o primeiro.</p>
        )}
      </div>
    </div>
  );
}
