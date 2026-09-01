import { Injectable } from '@nestjs/common';
import { decryptSecret, getMasterSecret } from '@viralforge/shared';
import { PrismaService } from './prisma.service.js';

const PLATFORM_AI_CONFIG_ID = 'default' as const;

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async getKeys(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { aiProviderIntegrations: true },
    });
    const masterSecret = getMasterSecret();
    if (!masterSecret) {
      throw new Error('MASTER_SECRET (ou API_KEY_ENCRYPTION_SECRET) não configurada');
    }
    // Pipeline usa um único provider de análise. PASS1 é o papel canônico;
    // PASS2 e LLM são aceitos como fallback para integrações salvas antes da unificação.
    const activeLlm =
      user.aiProviderIntegrations.find((provider) => provider.role === 'PASS1' && provider.active) ??
      user.aiProviderIntegrations.find((provider) => provider.role === 'PASS2' && provider.active) ??
      user.aiProviderIntegrations.find((provider) => provider.role === 'LLM' && provider.active);
    const activeTranscription = user.aiProviderIntegrations.find((provider) => provider.role === 'TRANSCRIPTION' && provider.active);
    const legacyDeepseekApiKey = decryptSecret(user.deepseekApiKeyEncrypted, masterSecret);
    const llmIntegrationKey = decryptSecret(activeLlm?.encryptedApiKey, masterSecret);
    const integrationTranscriptionKey = decryptSecret(activeTranscription?.encryptedApiKey, masterSecret);

    // Config global de IA controlada pelo admin. Quando ativa, tem prioridade
    // sobre as integrações por-usuário (a escolha de IA é centralizada).
    const platform = await this.prisma.platformAiConfig.findUnique({ where: { id: PLATFORM_AI_CONFIG_ID } });
    const useGlobalLlm = Boolean(platform?.llmActive && platform.llmApiKeyEncrypted && platform.llmModel);
    const useGlobalTranscription = Boolean(platform?.transcriptionActive && platform.transcriptionModel);
    const globalLlmKey = useGlobalLlm ? decryptSecret(platform!.llmApiKeyEncrypted, masterSecret) : null;
    const globalTranscriptionKey = useGlobalTranscription
      ? decryptSecret(platform!.transcriptionApiKeyEncrypted, masterSecret)
      : null;

    if (!useGlobalLlm) {
      for (const integration of [activeLlm, activeTranscription].filter(Boolean)) {
        await this.prisma.aiProviderIntegration.update({
          where: { id: integration!.id },
          data: { lastUsedAt: new Date() },
        });
      }
    }

    return {
      llmApiKey: useGlobalLlm ? globalLlmKey : (llmIntegrationKey ?? legacyDeepseekApiKey),
      llmBaseUrl: useGlobalLlm
        ? (platform!.llmBaseUrl ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com')
        : (activeLlm?.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'),
      llmModel: useGlobalLlm
        ? platform!.llmModel!
        : (activeLlm?.model ?? user.deepseekModel ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'),
      llmMaxCostUsd: platform?.llmMaxCostUsd !== undefined && platform?.llmMaxCostUsd !== null
        ? platform.llmMaxCostUsd
        : Number(process.env.LLM_MAX_COST_USD ?? 0.5),
      openaiApiKey: useGlobalTranscription
        ? (globalTranscriptionKey ?? process.env.OPENAI_API_KEY ?? null)
        : (integrationTranscriptionKey ??
          decryptSecret(user.openaiApiKeyEncrypted, masterSecret) ??
          process.env.OPENAI_API_KEY ??
          null),
      openaiTranscriptionBaseUrl: useGlobalTranscription
        ? (platform!.transcriptionBaseUrl ?? null)
        : (activeTranscription?.baseUrl ?? null),
      openaiTranscriptionModel: useGlobalTranscription
        ? (platform!.transcriptionModel ?? 'whisper-1')
        : (activeTranscription?.model ?? user.openaiTranscriptionModel ?? 'whisper-1'),
    };
  }
}
