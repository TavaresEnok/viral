'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AdminAiConfigInput, AdminAiConfigTestResult } from '@/types/api.types';
import { buildModelOptions } from './model-options';

// Catálogo de providers de análise (espelha o backend em settings.service.ts).
// Gemini vem primeiro porque é o free tier padrão da plataforma.
const LLM_CATALOG = [
  {
    provider: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      // Verificados por chamada real contra a API do Gemini em 01/09/2026.
      // A familia 2.5/2.0/1.5 responde 404 "no longer available to new users",
      // e os modelos *-pro respondem 429 no free tier — o catalogo antigo so
      // listava esses, entao qualquer escolha do dropdown quebrava a analise.
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
    ],
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'nvidia/nemotron-3-super-120b-a12b:free',
      'minimax/minimax-m3:free',
      'minimax/minimax-m2.7:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'openai/gpt-oss-120b:free',
      'openai/gpt-oss-20b:free',
    ],
  },
  {
    provider: 'nvidia',
    label: 'NVIDIA Build',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['nvidia/llama-3.3-nemotron-super-49b-v1.5', 'mistralai/mistral-large-3-675b-instruct-2512'],
  },
  {
    provider: 'grok',
    label: 'Grok / xAI',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-2-1212', 'grok-2-vision-1212'],
  },
  {
    provider: 'qwen',
    label: 'Qwen',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
  },
  {
    provider: 'kimi',
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.ai/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
] as const;

const CUSTOM = '__custom__';
const CUSTOM_MODEL_OPTION = '__custom_model_option__';

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      {hint && <span className="ml-2 text-xs text-ink-tertiary">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  'h-10 w-full rounded-input border border-hairline-subtle bg-base px-3 text-sm text-ink-primary outline-none transition placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3">
      <span className={cn('relative h-6 w-11 rounded-full transition', checked ? 'bg-accent' : 'bg-elevated')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      <span className="text-sm font-medium text-ink-primary">{label}</span>
    </button>
  );
}

export default function AdminAiPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-ai-config'], queryFn: api.admin.aiConfig, refetchOnWindowFocus: false });
  const [form, setForm] = useState<AdminAiConfigInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AdminAiConfigTestResult | null>(null);

  const [manualModelInput, setManualModelInput] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        llmActive: data.llmActive,
        llmProvider: data.llmProvider,
        llmModel: data.llmModel,
        llmBaseUrl: data.llmBaseUrl,
        llmApiKey: '',
        llmMaxCostUsd: data.llmMaxCostUsd ?? 0.5,
        transcriptionActive: data.transcriptionActive,
        transcriptionProvider: data.transcriptionProvider,
        transcriptionModel: data.transcriptionModel,
        transcriptionBaseUrl: data.transcriptionBaseUrl,
        transcriptionApiKey: '',
      });
      const entry = LLM_CATALOG.find((p) => p.provider === data.llmProvider);
      if (entry && data.llmModel && !(entry.models as readonly string[]).includes(data.llmModel)) {
        setManualModelInput(true);
      }
    }
  }, [data, form]);

  if (isLoading || !data || !form) return <Skeleton className="h-[560px] rounded-2xl" />;

  const set = (patch: Partial<AdminAiConfigInput>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const catalogEntry = LLM_CATALOG.find((p) => p.provider === form.llmProvider);
  const isCustomProvider = form.llmProvider !== '' && !catalogEntry;
  const catalogModels: string[] = catalogEntry ? [...catalogEntry.models] : [];

  function onProviderChange(value: string) {
    if (value === CUSTOM) {
      set({ llmProvider: '', llmModel: '', llmBaseUrl: '' });
      setManualModelInput(true);
      return;
    }
    const entry = LLM_CATALOG.find((p) => p.provider === value);
    if (entry) {
      set({ llmProvider: entry.provider, llmBaseUrl: entry.baseUrl, llmModel: entry.models[0] });
      setManualModelInput(false);
    }
  }

  function onModelSelectChange(value: string) {
    if (value === CUSTOM_MODEL_OPTION) {
      setManualModelInput(true);
    } else {
      set({ llmModel: value });
    }
  }

  // Testa sem salvar: manda o que está no formulário e deixa o backend
  // completar o resto com o que já está gravado.
  async function testConnection() {
    if (!form) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.admin.testAiConfig({
        llmModel: form.llmModel,
        llmBaseUrl: form.llmBaseUrl,
        llmApiKey: form.llmApiKey || undefined,
      });
      setTestResult(result);
      if (result.ok) toast.success('O modelo respondeu.');
      else toast.error('O modelo não respondeu — veja o detalhe abaixo.');
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : 'Falha ao testar' });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!form) return;
    if (form.llmActive && (!form.llmProvider || !form.llmModel)) {
      toast.error(
        !form.llmProvider
          ? 'Escolha um provider antes de ativar.'
          : 'Nenhum modelo selecionado. Abra a lista de Modelo e escolha um.',
      );
      return;
    }
    if (form.llmActive && !form.llmApiKey && !data?.llmKeySet) {
      toast.error('Informe a API key para ativar a IA global.');
      return;
    }
    setSaving(true);
    try {
      await api.admin.setAiConfig(form);
      toast.success('Configuração de IA salva — vale para todos os usuários.');
      set({ llmApiKey: '', transcriptionApiKey: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const providerLabel = catalogEntry?.label ?? data.llmProvider;

  return (
    <div className="mx-auto max-w-[760px] space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">Plataforma</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-primary md:text-4xl">Configuração de IA</h1>
        <p className="mt-2 text-sm text-ink-secondary">Quando ativa, esta IA é usada para <strong className="text-ink-primary">todos os usuários</strong>. Os criadores não escolhem o modelo.</p>
      </header>

      {/* Status atual — o que todos os usuários estão usando agora. */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl border p-4 text-sm',
          data.llmActive
            ? 'border-emerald-500/30 bg-emerald-500/5 text-ink-primary'
            : 'border-warning/30 bg-warning/5 text-ink-primary',
        )}
      >
        {data.llmActive ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        )}
        <div>
          {data.llmActive ? (
            <>
              <p className="font-semibold">IA global ativa</p>
              <p className="mt-0.5 text-ink-secondary">
                Todos os usuários usam <strong className="text-ink-primary">{data.llmModel}</strong>
                {providerLabel ? <> via <strong className="text-ink-primary">{providerLabel}</strong></> : null} para gerar os cortes.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">IA global inativa</p>
              <p className="mt-0.5 text-ink-secondary">Cada usuário cai na própria integração (ou no DeepSeek padrão). Ative abaixo para centralizar.</p>
            </>
          )}
        </div>
      </div>

      <section className="space-y-5 rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Análise de cortes (LLM)</h2>
          <Toggle checked={form.llmActive} onChange={(v) => set({ llmActive: v })} label={form.llmActive ? 'Ativa' : 'Inativa'} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <select className={inputCls} value={isCustomProvider ? CUSTOM : form.llmProvider} onChange={(e) => onProviderChange(e.target.value)}>
              <option value="" disabled>Selecione…</option>
              {LLM_CATALOG.map((p) => (
                <option key={p.provider} value={p.provider}>{p.label}</option>
              ))}
              <option value={CUSTOM}>Outro (manual)</option>
            </select>
          </Field>
          <Field
            label="Modelo"
            hint={
              catalogEntry && (
                <button
                  type="button"
                  onClick={() => setManualModelInput(!manualModelInput)}
                  className="text-xs text-accent hover:underline focus:outline-none"
                >
                  {manualModelInput ? '← Ver sugestões' : '✏️ Digitar manualmente'}
                </button>
              )
            }
          >
            {catalogEntry && !manualModelInput ? (
              <select className={inputCls} value={form.llmModel} onChange={(e) => onModelSelectChange(e.target.value)}>
                {buildModelOptions(catalogModels, form.llmModel).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                <option value={CUSTOM_MODEL_OPTION}>✏️ Outro (digitar ID do modelo)...</option>
              </select>
            ) : (
              <input
                className={inputCls}
                value={form.llmModel}
                onChange={(e) => set({ llmModel: e.target.value })}
                placeholder={form.llmProvider === 'openrouter' ? 'ex.: minimax/minimax-m3:free' : 'ex.: deepseek-chat'}
              />
            )}
          </Field>
        </div>

        {isCustomProvider && (
          <Field label="Provider (id)"><input className={inputCls} value={form.llmProvider} onChange={(e) => set({ llmProvider: e.target.value })} placeholder="ex.: openai" /></Field>
        )}

        <Field label="Base URL" hint={catalogEntry ? 'preenchida automaticamente' : 'compatível com a API da OpenAI'}>
          <input className={inputCls} value={form.llmBaseUrl} onChange={(e) => set({ llmBaseUrl: e.target.value })} placeholder="https://api.deepseek.com" />
        </Field>
        <Field label="API Key" hint={data.llmKeySet ? 'já configurada — deixe vazio para manter' : 'obrigatória para ativar'}>
          <input type="password" className={inputCls} value={form.llmApiKey} onChange={(e) => set({ llmApiKey: e.target.value })} placeholder={data.llmKeySet ? '•••••••• (mantém a atual)' : 'cole a chave aqui'} />
        </Field>

        <Field
          label="Teto de Custo por Vídeo (USD)"
          hint="limite máximo de custo estimado por vídeo para proteção (use 0 para desativar a trava)"
        >
          <input
            type="number"
            step="0.05"
            min="0"
            className={inputCls}
            value={form.llmMaxCostUsd ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              set({ llmMaxCostUsd: val });
            }}
            placeholder="0.50 (padrão)"
          />
        </Field>

        <div className="space-y-3 border-t border-hairline-subtle pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !form.llmModel || !form.llmBaseUrl}
              className="rounded-input border border-hairline-subtle px-4 py-2 text-sm font-semibold text-ink-primary transition hover:bg-elevated disabled:opacity-50"
            >
              {testing ? 'Testando...' : 'Testar conexão'}
            </button>
            <span className="text-xs text-ink-tertiary">
              Faz uma chamada real ao provider. Não salva nada.
            </span>
          </div>

          {testResult && (
            <div
              role="status"
              className={`rounded-input border p-3 text-xs ${
                testResult.ok
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-danger/40 bg-danger/15 text-danger'
              }`}
            >
              <p className="font-semibold">
                {testResult.ok ? '✓ Funcionando' : '✗ Não funcionou'}
                {testResult.model ? ` — ${testResult.model}` : ''}
              </p>
              <p className="mt-1 break-words opacity-90">{testResult.message}</p>
              {testResult.reply && <p className="mt-1 opacity-70">Resposta: {testResult.reply}</p>}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-hairline-subtle bg-surface p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-tertiary">Transcrição (ASR)</h2>
          <Toggle checked={form.transcriptionActive} onChange={(v) => set({ transcriptionActive: v })} label={form.transcriptionActive ? 'Ativa' : 'Inativa'} />
        </div>
        <p className="text-xs text-ink-tertiary">Deixe inativa para usar a transcrição local (node_agent / Whisper). Ative só para forçar um provider externo de ASR.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider"><input className={inputCls} value={form.transcriptionProvider} onChange={(e) => set({ transcriptionProvider: e.target.value })} placeholder="openai" /></Field>
          <Field label="Modelo"><input className={inputCls} value={form.transcriptionModel} onChange={(e) => set({ transcriptionModel: e.target.value })} placeholder="whisper-1" /></Field>
        </div>
        <Field label="Base URL" hint="opcional"><input className={inputCls} value={form.transcriptionBaseUrl} onChange={(e) => set({ transcriptionBaseUrl: e.target.value })} placeholder="https://api.openai.com/v1" /></Field>
        <Field label="API Key" hint={data.transcriptionKeySet ? 'já configurada — deixe vazio para manter' : 'opcional'}>
          <input type="password" className={inputCls} value={form.transcriptionApiKey} onChange={(e) => set({ transcriptionApiKey: e.target.value })} placeholder={data.transcriptionKeySet ? '•••••••• (mantém a atual)' : 'sk-...'} />
        </Field>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="rounded-input bg-accent px-6 py-2.5 text-sm font-bold text-[#10120A] transition hover:opacity-90 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  );
}
