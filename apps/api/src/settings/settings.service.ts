import { BadRequestException, Injectable } from '@nestjs/common';
import { decryptSecret, encryptSecret, getMasterSecret } from '@viralforge/shared';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { PrismaService } from '../prisma.service.js';
import type { UpdateApiKeysDto, UpsertAiProviderDto } from './dto.js';

function maskSecret(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 6) {
    return '****';
  }
  if (value.length <= 10) {
    return `${value.slice(0, 1)}****${value.slice(-1)}`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function sanitizeProviderError(value: string): string {
  return value
    .replace(/sk-or-v1-[a-zA-Z0-9_-]+/g, 'sk-or-v1-...')
    .replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-...')
    .replace(/nvapi-[a-zA-Z0-9_-]+/g, 'nvapi-...')
    .slice(0, 240);
}

// PASS1 é o papel canônico de análise; PASS2 e LLM existem apenas como
// fallback de leitura para integrações salvas antes da unificação em prompt único.
const ANALYSIS_ROLE = 'PASS1';
const LEGACY_ANALYSIS_ROLES = ['PASS2', 'LLM'];

function isAnalysisRole(role: string) {
  return role === ANALYSIS_ROLE || LEGACY_ANALYSIS_ROLES.includes(role);
}

function isPrivateIp(address: string): boolean {
  if (isIP(address) !== 4) return false;
  return (
    address.startsWith('10.') ||
    address.startsWith('127.') ||
    address.startsWith('0.') ||
    address.startsWith('192.168.') ||
    address.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

function defaultModelForRole(provider: { provider: string; models: string[]; role?: string }) {
  // A IA única faz seleção e curadoria juntas, então o default favorece o modelo mais capaz.
  if (provider.provider === 'openrouter') {
    return provider.models.includes('openai/gpt-oss-120b:free') ? 'openai/gpt-oss-120b:free' : provider.models[0];
  }

  return provider.models[0];
}

const llmProviderCatalog = [
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
      'openai/gpt-oss-20b:free',
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b:free',
      'openai/gpt-oss-120b',
      'nvidia/nemotron-3-nano-30b-a3b:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-super-120b-a12b',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-small-2603',
      'meta-llama/llama-3.1-70b-instruct',
    ],
  },
  {
    provider: 'nvidia',
    label: 'NVIDIA Build',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      'mistralai/mistral-large-3-675b-instruct-2512',
    ],
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
  {
    provider: 'minimax',
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['MiniMax-Text-01'],
  },
  {
    provider: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },
];

const providerCatalog = [
  ...llmProviderCatalog.map((provider) => ({ ...provider, role: ANALYSIS_ROLE })),
  {
    provider: 'claude',
    label: 'Claude direto',
    role: 'LLM_NATIVE',
    baseUrl: null,
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  {
    provider: 'openai-transcription',
    label: 'OpenAI Transcrição',
    role: 'TRANSCRIPTION',
    baseUrl: 'https://api.openai.com/v1',
    models: ['whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe'],
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter · Transcrição',
    role: 'TRANSCRIPTION',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3', 'qwen/qwen3-asr-flash-2026-02-10'],
  },
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const masterSecret = getMasterSecret();
    const deepseekApiKey = decryptSecret(user.deepseekApiKeyEncrypted, masterSecret);
    const openaiApiKey = decryptSecret(user.openaiApiKeyEncrypted, masterSecret);

    return {
      deepseek: {
        configured: Boolean(deepseekApiKey),
        maskedKey: maskSecret(deepseekApiKey),
        model: user.deepseekModel,
        availableModels: ['deepseek-chat', 'deepseek-reasoner'],
      },
      openai: {
        configured: Boolean(openaiApiKey || process.env.OPENAI_API_KEY),
        maskedKey: maskSecret(openaiApiKey),
        model: user.openaiTranscriptionModel,
        availableModels: ['whisper-1', 'gpt-4o-mini-transcribe'],
      },
    };
  }

  async providers(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { aiProviderIntegrations: true },
    });
    const masterSecret = getMasterSecret();
    const integrations = user.aiProviderIntegrations;
    const catalogKeys = new Set(providerCatalog.map((provider) => `${provider.provider}:${provider.role}`));

    const legacyDeepseekApiKey = decryptSecret(user.deepseekApiKeyEncrypted, masterSecret);
    const legacyOpenAiApiKey = decryptSecret(user.openaiApiKeyEncrypted, masterSecret);
    const legacyActiveAnalysis = LEGACY_ANALYSIS_ROLES
      .map((role) => integrations.find((item) => item.role === role && item.active))
      .find(Boolean);
    const catalogProviders = providerCatalog.map((provider) => {
      const integration = integrations.find((item) => item.provider === provider.provider && item.role === provider.role);
      const legacyIntegration =
        provider.role === ANALYSIS_ROLE
          ? LEGACY_ANALYSIS_ROLES
              .map((role) => integrations.find((item) => item.provider === provider.provider && item.role === role))
              .find(Boolean)
          : null;
      const legacyKey =
        provider.provider === 'deepseek'
          ? legacyDeepseekApiKey
          : provider.provider === 'openai-transcription'
            ? legacyOpenAiApiKey
            : null;
      const encryptedKey = integration?.encryptedApiKey ?? legacyIntegration?.encryptedApiKey;
      const configured = Boolean(encryptedKey || legacyKey);
      const storedModel = integration?.model ?? legacyIntegration?.model;
      const explicitRoleHasActive = integrations.some((item) => item.role === provider.role && item.active);
      const active =
        integration?.active ??
        (provider.role === ANALYSIS_ROLE
          ? !explicitRoleHasActive &&
            (provider.provider === legacyActiveAnalysis?.provider || (provider.provider === 'deepseek' && !legacyActiveAnalysis))
          : false);
      return {
        ...provider,
        configured,
        maskedKey: maskSecret(decryptSecret(encryptedKey, masterSecret) ?? legacyKey),
        active,
        model: configured && storedModel ? storedModel : provider.provider === 'deepseek' ? user.deepseekModel : defaultModelForRole(provider),
        customBaseUrl: integration?.baseUrl ?? legacyIntegration?.baseUrl ?? provider.baseUrl,
        supportsDirectUse: provider.role === ANALYSIS_ROLE || provider.role === 'TRANSCRIPTION',
        lastTestedAt: integration?.lastTestedAt ?? null,
        lastTestStatus: integration?.lastTestStatus ?? null,
        lastTestLatencyMs: integration?.lastTestLatencyMs ?? null,
        lastTestError: integration?.lastTestError ?? null,
        lastUsedAt: integration?.lastUsedAt ?? null,
      };
    });
    const customProviders = integrations
      .filter((integration) => !LEGACY_ANALYSIS_ROLES.includes(integration.role) && !catalogKeys.has(`${integration.provider}:${integration.role}`))
      .map((integration) => {
        const decrypted = decryptSecret(integration.encryptedApiKey, masterSecret);
        return {
          provider: integration.provider,
          label: integration.label,
          role: integration.role,
          baseUrl: integration.baseUrl,
          models: [integration.model],
          configured: Boolean(decrypted),
          maskedKey: maskSecret(decrypted),
          active: integration.active,
          model: integration.model,
          customBaseUrl: integration.baseUrl,
          supportsDirectUse: isAnalysisRole(integration.role) || integration.role === 'TRANSCRIPTION',
          lastTestedAt: integration.lastTestedAt ?? null,
          lastTestStatus: integration.lastTestStatus ?? null,
          lastTestLatencyMs: integration.lastTestLatencyMs ?? null,
          lastTestError: integration.lastTestError ?? null,
          lastUsedAt: integration.lastUsedAt ?? null,
        };
      });
    const merged = [...catalogProviders, ...customProviders];

    return {
      activeLlmProvider: merged.find((provider) => isAnalysisRole(provider.role) && provider.active)?.provider ?? 'deepseek',
      providers: merged,
    };
  }

  async upsertProvider(userId: string, dto: UpsertAiProviderDto) {
    const role = dto.role ?? 'PASS1';
    const catalog = providerCatalog.find((provider) => provider.provider === dto.provider && provider.role === role) ??
      providerCatalog.find((provider) => provider.provider === dto.provider);
    const label = dto.label || catalog?.label || dto.provider;
    const model = dto.model || catalog?.models[0] || '';
    const baseUrl = dto.baseUrl || catalog?.baseUrl || null;
    await this.assertSafeBaseUrl(baseUrl);
    const masterSecret = getMasterSecret();
    const active = dto.active === 'true' || dto.active === '1';
    const existing = await this.prisma.aiProviderIntegration.findUnique({
      where: { userId_provider_role: { userId, provider: dto.provider, role } },
      select: { encryptedApiKey: true },
    });
    const legacyKey = await this.getLegacyProviderKey(userId, dto.provider, masterSecret);
    if (active && !dto.apiKey && !existing?.encryptedApiKey && !legacyKey) {
      throw new BadRequestException('Configure uma chave antes de ativar este provider.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (active && (isAnalysisRole(role) || role === 'TRANSCRIPTION')) {
        await tx.aiProviderIntegration.updateMany({
          where: { userId, role: isAnalysisRole(role) ? { in: [ANALYSIS_ROLE, ...LEGACY_ANALYSIS_ROLES] } : role },
          data: { active: false },
        });
      }

      await tx.aiProviderIntegration.upsert({
        where: { userId_provider_role: { userId, provider: dto.provider, role } },
        update: {
          label,
          model,
          baseUrl,
          active,
          ...(dto.apiKey && { encryptedApiKey: encryptSecret(dto.apiKey, masterSecret) }),
        },
        create: {
          userId,
          provider: dto.provider,
          label,
          role,
          model,
          baseUrl,
          active,
          encryptedApiKey: dto.apiKey ? encryptSecret(dto.apiKey, masterSecret) : null,
        },
      });
    });

    return this.providers(userId);
  }

  async activateProvider(userId: string, provider: string) {
    return this.activateProviderForRole(userId, provider, 'PASS1');
  }

  async activateProviderForRole(userId: string, provider: string, role: string) {
    const integration = await this.prisma.aiProviderIntegration.findUnique({
      where: { userId_provider_role: { userId, provider, role } },
      select: { encryptedApiKey: true },
    });
    const legacyKey = await this.getLegacyProviderKey(userId, provider, getMasterSecret());
    if (!integration?.encryptedApiKey && !legacyKey) {
      throw new BadRequestException('Configure e salve uma chave antes de ativar este provider.');
    }
    await this.prisma.aiProviderIntegration.updateMany({
      where: { userId, role: isAnalysisRole(role) ? { in: [ANALYSIS_ROLE, ...LEGACY_ANALYSIS_ROLES] } : role },
      data: { active: false },
    });
    await this.prisma.aiProviderIntegration.updateMany({
      where: { userId, provider, role },
      data: { active: true },
    });
    return this.providers(userId);
  }

  async removeAiProvider(userId: string, provider: string, role?: string) {
    await this.prisma.aiProviderIntegration.deleteMany({
      where: { userId, provider, ...(role && { role }) },
    });
    return this.providers(userId);
  }

  async testProvider(userId: string, provider: string, role?: string) {
    const integration = await this.prisma.aiProviderIntegration.findFirst({ where: { userId, provider, ...(role && { role }) } });
    const catalog =
      providerCatalog.find((item) => item.provider === provider && (!role || item.role === role)) ??
      providerCatalog.find((item) => item.provider === provider);
    const startedAt = Date.now();

    if (catalog?.role === 'LLM_NATIVE') {
      return this.persistTestResult(userId, provider, catalog, role, {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: 'Provider nativo ainda não roda direto no pipeline. Use via OpenRouter.',
      });
    }

    const masterSecret = getMasterSecret();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const apiKey =
      decryptSecret(integration?.encryptedApiKey, masterSecret) ??
      (provider === 'deepseek'
        ? decryptSecret(user.deepseekApiKeyEncrypted, masterSecret)
        : provider === 'openai-transcription'
          ? decryptSecret(user.openaiApiKeyEncrypted, masterSecret)
          : null);

    if (!apiKey) {
      return this.persistTestResult(userId, provider, catalog, role, {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: 'Configure uma chave antes de testar.',
      });
    }

    const baseUrl = integration?.baseUrl ?? catalog?.baseUrl;
    await this.assertSafeBaseUrl(baseUrl);
    const model = integration?.model ?? (provider === 'deepseek' ? user.deepseekModel : catalog?.models[0]);
    if (!baseUrl) {
      return this.persistTestResult(userId, provider, catalog, role, {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: 'Provider sem baseURL testável.',
      });
    }

    try {
      const response =
        catalog?.role === 'TRANSCRIPTION'
          ? await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(12000),
            })
          : await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Responda apenas OK.' }],
                max_tokens: 4,
                temperature: 0,
              }),
              signal: AbortSignal.timeout(15000),
            });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }
      return this.persistTestResult(userId, provider, catalog, role, {
        ok: true,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      return this.persistTestResult(userId, provider, catalog, role, {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? sanitizeProviderError(error.message) : 'Falha ao testar provider.',
      });
    }
  }

  private async persistTestResult(
    userId: string,
    provider: string,
    catalog: (typeof providerCatalog)[number] | undefined,
    requestedRole: string | undefined,
    result: { ok: boolean; latencyMs: number; error?: string },
  ) {
    const role = requestedRole ?? catalog?.role ?? 'PASS1';
    await this.prisma.aiProviderIntegration.upsert({
      where: { userId_provider_role: { userId, provider, role } },
      update: {
        lastTestedAt: new Date(),
        lastTestStatus: result.ok ? 'OK' : 'ERROR',
        lastTestLatencyMs: result.latencyMs,
        lastTestError: result.error ?? null,
      },
      create: {
        userId,
        provider,
        role,
        label: catalog?.label ?? provider,
        model: catalog?.models[0] ?? 'unknown',
        baseUrl: catalog?.baseUrl ?? null,
        lastTestedAt: new Date(),
        lastTestStatus: result.ok ? 'OK' : 'ERROR',
        lastTestLatencyMs: result.latencyMs,
        lastTestError: result.error ?? null,
      },
    });

    return {
      ok: result.ok,
      latencyMs: result.latencyMs,
      message: result.ok ? 'Conexão validada com sucesso.' : result.error,
      providers: await this.providers(userId),
    };
  }

  private async assertSafeBaseUrl(baseUrl: string | null | undefined) {
    if (!baseUrl) return;
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new BadRequestException('Base URL inválida');
    }
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new BadRequestException('Base URL deve usar HTTP ou HTTPS');
    }
    if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_PRIVATE_PROVIDER_BASE_URLS === 'true') {
      return;
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('Em produção, Base URL de provider deve usar HTTPS');
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateIp(hostname)) {
      throw new BadRequestException('Base URL privada não permitida em produção');
    }
    const resolved = await dns.resolve4(hostname).catch(() => []);
    if (resolved.some(isPrivateIp)) {
      throw new BadRequestException('Base URL resolve para IP privado e foi bloqueada');
    }
  }

  private async getLegacyProviderKey(userId: string, provider: string, masterSecret: string) {
    if (provider !== 'deepseek' && provider !== 'openai-transcription') return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deepseekApiKeyEncrypted: true, openaiApiKeyEncrypted: true },
    });
    if (!user) return null;
    return provider === 'deepseek'
      ? decryptSecret(user.deepseekApiKeyEncrypted, masterSecret)
      : decryptSecret(user.openaiApiKeyEncrypted, masterSecret);
  }

  async updateApiKeys(userId: string, dto: UpdateApiKeysDto) {
    const masterSecret = getMasterSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.deepseekApiKey && {
          deepseekApiKeyEncrypted: encryptSecret(dto.deepseekApiKey, masterSecret),
        }),
        ...(dto.openaiApiKey && {
          openaiApiKeyEncrypted: encryptSecret(dto.openaiApiKey, masterSecret),
        }),
        ...(dto.deepseekModel && {
          deepseekModel: dto.deepseekModel,
        }),
        ...(dto.openaiTranscriptionModel && {
          openaiTranscriptionModel: dto.openaiTranscriptionModel,
        }),
      },
    });
    return this.status(userId);
  }

  async removeApiKeys(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deepseekApiKeyEncrypted: null,
        openaiApiKeyEncrypted: null,
      },
    });
    return this.status(userId);
  }

  async removeApiKey(userId: string, provider: string) {
    const normalized = provider.toLowerCase();
    if (!['deepseek', 'openai'].includes(normalized)) {
      return this.status(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data:
        normalized === 'deepseek'
          ? { deepseekApiKeyEncrypted: null }
          : { openaiApiKeyEncrypted: null },
    });
    return this.status(userId);
  }
}
