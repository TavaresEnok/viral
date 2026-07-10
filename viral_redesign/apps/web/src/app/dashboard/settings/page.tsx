'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Gem,
  Loader2,
  Mic,
  Pickaxe,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { capture } from '@/lib/analytics';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AiProviderStatus } from '@/types/api.types';

type Draft = Record<string, { apiKey: string; model: string; baseUrl: string }>;
type PipelineRole = 'PASS1' | 'PASS2';

const providerTemplates = [
  { provider: 'openrouter', label: 'OpenRouter', hint: 'roteador para centenas de modelos', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-oss-20b:free' },
  { provider: 'nvidia', label: 'NVIDIA Build', hint: 'endpoint OpenAI-compatible da NVIDIA', baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
  { provider: 'grok', label: 'Grok (xAI)', hint: 'modelo da xAI', baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest' },
  { provider: 'gemini', label: 'Google Gemini', hint: 'via endpoint compatível OpenAI', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-1.5-pro' },
  { provider: 'claude', label: 'Claude', hint: 'use via OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
  { provider: 'kimi', label: 'Kimi', hint: 'contexto longo', baseUrl: 'https://api.moonshot.ai/v1', model: 'moonshot-v1-128k' },
  { provider: 'qwen', label: 'Qwen', hint: 'bom custo-benefício', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { provider: 'minimax', label: 'MiniMax', hint: 'alternativa multimodal', baseUrl: 'https://api.minimax.chat/v1', model: 'abab6.5s-chat' },
];

function defaultModelForRole(template: (typeof providerTemplates)[number], role: PipelineRole) {
  if (template.provider === 'openrouter' && role === 'PASS2') {
    return 'openai/gpt-oss-120b:free';
  }

  if (template.provider === 'nvidia' && role === 'PASS2') {
    return 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
  }

  return template.model;
}

function keyOf(provider: Pick<AiProviderStatus, 'provider' | 'role'>) {
  return `${provider.provider}:${provider.role}`;
}

function roleName(role: string) {
  if (role === 'PASS1') return 'A trabalhadora';
  if (role === 'PASS2') return 'A revisora';
  if (role === 'TRANSCRIPTION') return 'Transcrição';
  return role;
}

function testSummary(provider: AiProviderStatus) {
  if (!provider.lastTestedAt) return 'Nunca testado';
  const status = provider.lastTestStatus === 'OK' ? 'OK' : 'Falhou';
  const latency = typeof provider.lastTestLatencyMs === 'number' ? ` · ${provider.lastTestLatencyMs}ms` : '';
  return `${status}${latency}`;
}

export default function SettingsPage() {
  const { data, refetch, isLoading } = useQuery({ queryKey: ['ai-providers'], queryFn: api.settings.providers, staleTime: 15_000, refetchOnWindowFocus: false });
  const [drafts, setDrafts] = useState<Draft>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    capture('settings_ai_viewed');
  }, []);

  useEffect(() => {
    if (!data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const provider of data.providers) {
        next[keyOf(provider)] ??= {
          apiKey: '',
          model: provider.model,
          baseUrl: provider.customBaseUrl ?? provider.baseUrl ?? '',
        };
      }
      return next;
    });
  }, [data]);

  const providers = data?.providers ?? [];
  const llmProviders = providers.filter((provider) => provider.role === 'PASS1' || provider.role === 'PASS2' || provider.role === 'LLM_NATIVE');
  const transcriptionProviders = providers.filter((provider) => provider.role === 'TRANSCRIPTION');
  const pass1Providers = llmProviders.filter((provider) => provider.role === 'PASS1');
  const pass2Providers = llmProviders.filter((provider) => provider.role === 'PASS2');
  const activePass1 = providers.find((provider) => provider.role === 'PASS1' && provider.active);
  const activePass2 = providers.find((provider) => provider.role === 'PASS2' && provider.active);

  const configuredKeys = useMemo(() => new Set(llmProviders.map((provider) => keyOf(provider))), [llmProviders]);

  function updateDraft(provider: AiProviderStatus, patch: Partial<Draft[string]>) {
    const key = keyOf(provider);
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { apiKey: '', model: provider.model, baseUrl: provider.customBaseUrl ?? provider.baseUrl ?? '' }), ...patch },
    }));
  }

  async function save(provider: AiProviderStatus, active = provider.active) {
    const key = keyOf(provider);
    const draft = drafts[key];
    setSaving(key);
    try {
      await api.settings.upsertProvider({
        provider: provider.provider,
        label: provider.label,
        role: provider.role,
        ...(draft?.apiKey.trim() && { apiKey: draft.apiKey.trim() }),
        baseUrl: draft?.baseUrl?.trim() || provider.baseUrl,
        model: draft?.model || provider.model,
        active: active ? 'true' : 'false',
      });
      updateDraft(provider, { apiKey: '' });
      await refetch();
      capture('ai_provider_saved', { provider: provider.provider, role: provider.role, active });
      toast.success(`${provider.label} atualizado`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar integração');
    } finally {
      setSaving(null);
    }
  }

  async function addProvider(template: (typeof providerTemplates)[number], role: PipelineRole) {
    const key = `${template.provider}:${role}:new`;
    setSaving(key);
    try {
      await api.settings.upsertProvider({
        provider: template.provider,
        label: template.label,
        role,
        baseUrl: template.baseUrl,
        model: defaultModelForRole(template, role),
        active: 'false',
      });
      await refetch();
      capture('ai_provider_saved', { provider: template.provider, role, custom: true, active: false });
      toast.success(`${template.label} adicionado`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao adicionar provider');
    } finally {
      setSaving(null);
    }
  }

  async function activate(provider: AiProviderStatus) {
    if (!provider.configured) {
      await save(provider, true);
      return;
    }
    const key = keyOf(provider);
    setSaving(key);
    try {
      await api.settings.activateProvider(provider.provider, provider.role);
      await refetch();
      capture('ai_provider_activated', { provider: provider.provider, role: provider.role });
      toast.success(`${provider.label} agora está em uso`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao ativar provider');
    } finally {
      setSaving(null);
    }
  }

  async function test(provider: AiProviderStatus) {
    const key = keyOf(provider);
    setTesting(key);
    try {
      const result = await api.settings.testProvider(provider.provider, provider.role);
      await refetch();
      capture('ai_provider_tested', { provider: provider.provider, role: provider.role, ok: result.ok, latencyMs: result.latencyMs });
      if (result.ok) toast.success(`${provider.label}: ${result.latencyMs}ms`);
      else toast.error(result.message ?? 'Falha ao testar provider');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao testar provider');
    } finally {
      setTesting(null);
    }
  }

  async function remove(provider: AiProviderStatus) {
    const key = keyOf(provider);
    setRemoving(key);
    try {
      await api.settings.removeProvider(provider.provider, provider.role);
      await refetch();
      capture('ai_provider_removed', { provider: provider.provider, role: provider.role });
      toast.success(`${provider.label} removido`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao remover provider');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-1 py-2 md:px-4 md:py-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink-primary">Integrações de IA</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          O ViralForge usa duas IAs para analisar cada vídeo: uma faz o trabalho pesado, outra refina os melhores cortes.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-hairline-subtle bg-gradient-to-br from-elevated/80 to-surface p-5 md:p-8">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-ink-primary">Como suas IAs vão trabalhar</h2>
          <p className="mt-1 max-w-md text-xs text-ink-tertiary">Você decide quem faz cada parte do pipeline editorial.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <RoleCard
            title="A trabalhadora"
            subtitle="lê o vídeo inteiro, procura momentos promissores"
            hint="Faz muito trabalho. Use uma IA barata e rápida."
            icon={<Pickaxe className="h-5 w-5 text-amber-300" />}
            provider={activePass1}
            providers={pass1Providers}
            onSwap={(provider) => activate(provider)}
          />
          <RoleCard
            title="A revisora"
            subtitle="recebe os candidatos, escolhe os melhores"
            hint="Trabalha pouco, mas precisa ser mais inteligente."
            icon={<Gem className="h-5 w-5 text-indigo-300" />}
            provider={activePass2}
            providers={pass2Providers}
            onSwap={(provider) => activate(provider)}
          />
        </div>
        {activePass1 && activePass2 && activePass1.provider === activePass2.provider && (
          <p className="mt-4 rounded-xl border border-hairline-subtle bg-base/50 p-3 text-xs leading-relaxed text-ink-secondary">
            Você está usando <span className="font-medium text-ink-primary">{activePass1.label}</span> para as duas etapas. É simples, mas dá para economizar usando uma IA mais barata no Pass 1.
          </p>
        )}
      </section>

      {isLoading ? (
        <div className="rounded-xl border border-hairline-subtle bg-surface p-6 text-sm text-ink-secondary">Carregando providers...</div>
      ) : (
        <>
          <section className="mb-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-ink-primary">Suas IAs</h2>
                <p className="mt-1 text-xs text-ink-tertiary">{llmProviders.length} providers configurados</p>
              </div>
              <AddProviderPicker configuredKeys={configuredKeys} onAdd={addProvider} saving={saving} />
            </div>
            <div className="space-y-3">
              {llmProviders.map((provider) => {
                const key = keyOf(provider);
                return (
                  <ProviderCard
                    key={key}
                    provider={provider}
                    draft={drafts[key]}
                    expanded={expanded === key}
                    showKey={Boolean(showKey[key])}
                    saving={saving === key}
                    testing={testing === key}
                    removing={removing === key}
                    usedInPipeline={provider.active}
                    onToggle={() => setExpanded((current) => (current === key ? null : key))}
                    onToggleKey={() => setShowKey((current) => ({ ...current, [key]: !current[key] }))}
                    onDraft={(patch) => updateDraft(provider, patch)}
                    onSave={() => save(provider)}
                    onTest={() => test(provider)}
                    onRemove={() => remove(provider)}
                    onActivate={() => activate(provider)}
                  />
                );
              })}
            </div>
          </section>

          <section className="pb-10">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-ink-primary">Transcrição de áudio</h2>
              <p className="mt-1 text-xs text-ink-tertiary">Só é usado quando o YouTube não oferece legenda aproveitável.</p>
            </div>
            <div className="space-y-3">
              {transcriptionProviders.map((provider) => {
                const key = keyOf(provider);
                return (
                  <ProviderCard
                    key={key}
                    provider={provider}
                    draft={drafts[key]}
                    expanded={expanded === key}
                    showKey={Boolean(showKey[key])}
                    saving={saving === key}
                    testing={testing === key}
                    removing={removing === key}
                    usedInPipeline={provider.active}
                    icon={<Mic className="h-5 w-5" />}
                    onToggle={() => setExpanded((current) => (current === key ? null : key))}
                    onToggleKey={() => setShowKey((current) => ({ ...current, [key]: !current[key] }))}
                    onDraft={(patch) => updateDraft(provider, patch)}
                    onSave={() => save(provider, true)}
                    onTest={() => test(provider)}
                    onRemove={() => remove(provider)}
                    onActivate={() => save(provider, true)}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RoleCard({
  title,
  subtitle,
  hint,
  icon,
  provider,
  providers,
  onSwap,
}: {
  title: string;
  subtitle: string;
  hint: string;
  icon: ReactNode;
  provider?: AiProviderStatus;
  providers: AiProviderStatus[];
  onSwap: (provider: AiProviderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const configured = providers.filter((item) => item.configured);
  const unconfigured = providers.filter((item) => !item.configured);

  return (
    <article className="rounded-xl border border-hairline-subtle bg-surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-elevated">{icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-tertiary">{subtitle}</p>
        </div>
      </div>
      <div className="rounded-lg border border-hairline-subtle bg-base/50 p-3">
        <div className="flex items-center justify-between gap-3">
          {provider ? (
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-ink-tertiary">
                Usando <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </p>
              <p className="truncate text-sm font-semibold text-ink-primary">{provider.label}</p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-ink-tertiary">{provider.model}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-ink-tertiary"><AlertCircle className="h-4 w-4" /> Nenhuma IA escolhida</div>
          )}
          <button type="button" onClick={() => setOpen((current) => !current)} className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-ink-secondary transition hover:bg-elevated hover:text-ink-primary">
            Trocar <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
          </button>
        </div>
        {open && (
          <div className="mt-3 space-y-1 border-t border-hairline-subtle pt-3">
            {configured.length ? configured.map((item) => (
              <button key={keyOf(item)} type="button" onClick={() => { onSwap(item); setOpen(false); }} className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition', item.provider === provider?.provider ? 'bg-accent/15 text-teal-200' : 'text-ink-secondary hover:bg-elevated')}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="font-medium">{item.label}</span>
                <span className="ml-auto hidden truncate font-mono text-[10px] text-ink-tertiary sm:inline">{item.model}</span>
              </button>
            )) : <p className="px-3 py-2 text-xs italic text-ink-tertiary">Configure uma IA abaixo primeiro.</p>}
            {unconfigured.length > 0 && (
              <p className="px-3 pt-2 text-[11px] leading-relaxed text-ink-tertiary">
                {unconfigured.length} opção{unconfigured.length === 1 ? '' : 'ões'} não aparece{unconfigured.length === 1 ? '' : 'm'} aqui porque ainda não tem chave salva nesta conta.
              </p>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-tertiary">{hint}</p>
    </article>
  );
}

function ProviderCard({
  provider,
  draft,
  expanded,
  showKey,
  saving,
  testing,
  removing,
  usedInPipeline,
  icon,
  onToggle,
  onToggleKey,
  onDraft,
  onSave,
  onTest,
  onRemove,
  onActivate,
}: {
  provider: AiProviderStatus;
  draft?: Draft[string];
  expanded: boolean;
  showKey: boolean;
  saving: boolean;
  testing: boolean;
  removing: boolean;
  usedInPipeline: boolean;
  icon?: ReactNode;
  onToggle: () => void;
  onToggleKey: () => void;
  onDraft: (patch: Partial<Draft[string]>) => void;
  onSave: () => void;
  onTest: () => void;
  onRemove: () => void;
  onActivate: () => void;
}) {
  const configured = provider.configured;
  const nativeLocked = provider.role === 'LLM_NATIVE' || provider.supportsDirectUse === false;

  return (
    <article className={cn('overflow-hidden rounded-xl border transition-colors', configured ? 'border-hairline-subtle bg-surface hover:border-hairline-strong' : 'border-hairline-subtle/70 bg-surface/60')}>
      <div className="flex cursor-pointer items-center gap-3 p-4" onClick={onToggle}>
        <div className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-lg', configured ? 'bg-elevated text-ink-secondary' : 'border border-dashed border-hairline-strong bg-base text-ink-tertiary')}>
          {icon ?? <span className="text-sm font-bold">{provider.label.slice(0, 1)}</span>}
          {configured && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-surface bg-emerald-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ink-primary">{provider.label}</h3>
            <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-tertiary">{roleName(provider.role)}</span>
            {usedInPipeline && <span className="rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-teal-200">Em uso</span>}
          </div>
          <p className="mt-1 truncate text-[11px] text-ink-tertiary">
            {configured ? `${provider.model} · ${provider.maskedKey ?? 'chave mascarada'} · ${testSummary(provider)}` : 'Sem credencial configurada'}
          </p>
          {provider.lastTestError && <p className="mt-1 truncate text-[11px] text-red-300">{provider.lastTestError}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {configured && (
            <button type="button" onClick={onTest} className="rounded-md px-2.5 py-1.5 text-xs text-ink-secondary hover:bg-elevated hover:text-ink-primary">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Testar'}
            </button>
          )}
          <button type="button" onClick={onToggle} aria-label={expanded ? 'Recolher configurações' : 'Expandir configurações'} className="rounded-md p-1.5 text-ink-tertiary hover:bg-elevated hover:text-ink-primary">
            <ChevronDown className={cn('h-4 w-4 transition', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      <div className={cn('overflow-hidden transition-all duration-300', expanded ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0')}>
        <div className="space-y-4 border-t border-hairline-subtle bg-base/45 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="api-key-input" className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">API key</label>
              <div className="relative">
                <input
                  id="api-key-input"
                  type={showKey ? 'text' : 'password'}
                  value={draft?.apiKey ?? ''}
                  onChange={(event) => onDraft({ apiKey: event.target.value })}
                  placeholder={provider.maskedKey ?? 'sk-...'}
                  className="h-10 w-full rounded-lg border border-hairline-subtle bg-base pl-3 pr-9 font-mono text-sm text-ink-primary outline-none transition placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <button type="button" onClick={onToggleKey} aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-tertiary hover:text-ink-primary">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Input id={`${keyOf(provider)}-model`} label="Modelo" value={draft?.model ?? provider.model} onChange={(event) => onDraft({ model: event.target.value })} />
          </div>
          <Input id={`${keyOf(provider)}-base`} label="Base URL" value={draft?.baseUrl ?? provider.customBaseUrl ?? provider.baseUrl ?? ''} disabled={nativeLocked} onChange={(event) => onDraft({ baseUrl: event.target.value })} />
          {nativeLocked && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
              Provider nativo bloqueado para uso direto. Para usar hoje no pipeline, conecte esse modelo via OpenRouter ou endpoint OpenAI-compatible.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="button" disabled={!configured || removing} onClick={onRemove} className="inline-flex items-center gap-1.5 text-xs text-ink-tertiary transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40">
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remover provider
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" disabled={nativeLocked || !configured} onClick={onTest} loading={testing}>
                <Play className="h-3.5 w-3.5" /> Testar
              </Button>
              <Button type="button" variant="secondary" disabled={nativeLocked} onClick={onSave} loading={saving}>
                Salvar
              </Button>
              <Button type="button" disabled={nativeLocked} onClick={onActivate} loading={saving}>
                <Check className="h-3.5 w-3.5" /> Usar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AddProviderPicker({
  configuredKeys,
  onAdd,
  saving,
}: {
  configuredKeys: Set<string>;
  onAdd: (template: (typeof providerTemplates)[number], role: PipelineRole) => void;
  saving: string | null;
}) {
  const [open, setOpen] = useState(false);
  const remaining = providerTemplates.filter((item) => !configuredKeys.has(`${item.provider}:PASS1`) || !configuredKeys.has(`${item.provider}:PASS2`));

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline-subtle bg-elevated px-3 py-2 text-xs font-medium text-ink-secondary transition hover:text-ink-primary">
        <Plus className="h-4 w-4" /> Adicionar provider
      </button>
      {open && (
        <>
          <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-hairline-subtle bg-surface shadow-2xl">
            <div className="max-h-80 overflow-y-auto p-1.5">
              {remaining.map((template) => {
                const pass1Configured = configuredKeys.has(`${template.provider}:PASS1`);
                const pass2Configured = configuredKeys.has(`${template.provider}:PASS2`);

                return (
                <div key={template.provider} className="rounded-lg p-2 hover:bg-elevated">
                  <div className="mb-2">
                    <p className="text-sm font-medium text-ink-primary">{template.label}</p>
                    <p className="text-[11px] text-ink-tertiary">{template.hint}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={pass1Configured || saving?.startsWith(template.provider)} onClick={() => { onAdd(template, 'PASS1'); setOpen(false); }} className="rounded-md border border-hairline-subtle px-2.5 py-1.5 text-[11px] text-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-45">
                      {pass1Configured ? 'Pass 1 adicionado' : 'Pass 1'}
                    </button>
                    <button type="button" disabled={pass2Configured || saving?.startsWith(template.provider)} onClick={() => { onAdd(template, 'PASS2'); setOpen(false); }} className="rounded-md border border-hairline-subtle px-2.5 py-1.5 text-[11px] text-ink-secondary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-45">
                      {pass2Configured ? 'Pass 2 adicionado' : 'Pass 2'}
                    </button>
                  </div>
                </div>
                );
              })}
              {!remaining.length && <p className="p-3 text-xs italic text-ink-tertiary">Todos os templates já foram adicionados.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
