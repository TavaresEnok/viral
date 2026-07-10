import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

const MIN_FEEDBACK_SAMPLE = 5;
const MIN_REASON_COUNT = 3;
const MIN_REASON_SHARE = 0.2;
const FEEDBACK_LOOKBACK = 300;

// Cada motivo de rejeição mapeia para a dimensão do prompt que precisa
// endurecer. OTHER não gera orientação (sem sinal acionável).
const REASON_GUIDANCE: Record<string, string> = {
  WEAK_START:
    'Este usuário rejeita cortes por abertura fraca com frequência. Seja mais rígido no opening_strength: só aprove hooks que param o scroll de verdade.',
  WEAK_END:
    'Este usuário rejeita cortes por fechamento fraco com frequência. Seja mais rígido no closing_strength: prefira descartar a aprovar um corte com fim arrastado.',
  NOT_VIRAL:
    'Este usuário rejeita cortes por baixo potencial viral com frequência. Seja mais rígido em emotional_density e quotability: corte apenas trechos com emoção ou frase de impacto claras.',
  MISSING_CONTEXT:
    'Este usuário rejeita cortes que dependem de contexto com frequência. Seja mais rígido no context_independence_score: o corte precisa funcionar 100% sozinho.',
  BAD_CAPTION:
    'Este usuário rejeita títulos/legendas ruins com frequência. Capriche em title e suggested_caption_title: curtos, específicos e fiéis ao conteúdo.',
};

@Injectable()
export class FeedbackProfileService {
  private readonly logger = new Logger(FeedbackProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resume o histórico de rejeições do usuário em orientações para o prompt
   * de análise. Retorna undefined quando não há amostra suficiente — nesse
   * caso o prompt segue sem personalização.
   */
  async buildFeedbackNotes(userId: string): Promise<string | undefined> {
    const feedbacks = await this.prisma.clipFeedback.findMany({
      where: { userId },
      select: { reason: true },
      orderBy: { createdAt: 'desc' },
      take: FEEDBACK_LOOKBACK,
    });

    if (feedbacks.length < MIN_FEEDBACK_SAMPLE) {
      return undefined;
    }

    const counts = new Map<string, number>();
    for (const feedback of feedbacks) {
      counts.set(feedback.reason, (counts.get(feedback.reason) ?? 0) + 1);
    }

    const lines: string[] = [];
    for (const [reason, guidance] of Object.entries(REASON_GUIDANCE)) {
      const count = counts.get(reason) ?? 0;
      if (count >= MIN_REASON_COUNT && count / feedbacks.length >= MIN_REASON_SHARE) {
        lines.push(`- ${guidance} (${count} de ${feedbacks.length} rejeições)`);
      }
    }

    if (!lines.length) {
      return undefined;
    }

    this.logger.log({ msg: 'Perfil de feedback aplicado ao prompt', userId, reasons: lines.length });
    return lines.join('\n');
  }
}
