import { Injectable } from '@nestjs/common';
import type { OverlayItem, WordSegment } from '@viralforge/render-engine';

const KEYWORD_EMOJI_MAP: Array<{ pattern: RegExp; emoji: string; intensity: 'subtle' | 'balanced' | 'loud' }> = [
  { pattern: /\b(incr[ií]vel|uau|nossa|caramba|nunca|jamais|absurdo|impressionante|genial|fenomenal)\b/i, emoji: '😱', intensity: 'loud' },
  { pattern: /\b(amo(r|r)|paix[aã]o|adoro|maravilhoso|lindo|perfeito|gratid[aã]o|obrigado)\b/i, emoji: '❤️', intensity: 'balanced' },
  { pattern: /\b(fogo|pegando|quente|viral|explodiu|bomba|hype| hype)\b/i, emoji: '🔥', intensity: 'loud' },
  { pattern: /\b(rindo|risos|haha|kkkk|hue|morri|cai|engraçado|hil[aá]rio|piada)\b/i, emoji: '😂', intensity: 'balanced' },
  { pattern: /\b(mente|brain|cérebro|gênio|inteligente|nível|mind|blow|mindblow)\b/i, emoji: '🧠', intensity: 'subtle' },
  { pattern: /\b(olha|atenção|alerta|importante|escuta|segura|pera|aguenta)\b/i, emoji: '👀', intensity: 'balanced' },
  { pattern: /\b(recorde|top|primeiro|número\s*1|melhor|maior|lenda|goat|mito)\b/i, emoji: '🏆', intensity: 'loud' },
  { pattern: /\b(dinheiro|fatura|receita|milhão|bilhão|lucro|rico|grana)\b/i, emoji: '💰', intensity: 'balanced' },
  { pattern: /\b(negócio|empreendedor|startup|empresa|mercado|venda|business|estráteg)\b/i, emoji: '📈', intensity: 'subtle' },
  { pattern: /\b(deus|jesus|senhor|amém|milagre|abençoado|fé)\b/i, emoji: '🙏', intensity: 'balanced' },
  { pattern: /\b(música|som|ritmo|melodia|beat|batida|tocando|ouvir)\b/i, emoji: '🎵', intensity: 'subtle' },
  { pattern: /\b(festa|balada|rolê|celebra|comemora|party|parabéns)\b/i, emoji: '🎉', intensity: 'loud' },
  { pattern: /\b(ideia|criativo|inovador|novo| lança|revolucion[áa]rio|diferente)\b/i, emoji: '💡', intensity: 'subtle' },
  { pattern: /\b(problema|erro|falhou|quebrou|bug|crash|fudeu|merda|droga|putz)\b/i, emoji: '🤦', intensity: 'balanced' },
  { pattern: /\b(força|determinação|superação|foco|disciplina|garra|persistência|vencer)\b/i, emoji: '💪', intensity: 'loud' },
  { pattern: /\b(palavra|prometo|juro|verdade|sério|falando sério|fato)\b/i, emoji: '🤝', intensity: 'subtle' },
];

const KEYWORD_SFX_MAP: Array<{ pattern: RegExp; sfx: string }> = [
  { pattern: /\b(uau|nossa|caramba|incr[ií]vel|genial|fenomenal)\b/i, sfx: 'wow' },
  { pattern: /\b(rindo|risos|haha|kkkk|hue|engraçado|hilário|morri de rir)\b/i, sfx: 'laugh' },
  { pattern: /\b(fogo|pegando|quente|explodiu|bomba)\b/i, sfx: 'fire' },
  { pattern: /\b(problema|erro|falhou|quebrou|fudeu|merda)\b/i, sfx: 'fail' },
  { pattern: /\b(alerta|atenção|perigo|cuidado|segura)\b/i, sfx: 'alert' },
  { pattern: /\b(música|tocando|som|ritmo)\b/i, sfx: 'ding' },
  { pattern: /\b(vitória|ganhou|recorde|vencer|top|primeiro)\b/i, sfx: 'success' },
];

@Injectable()
export class OverlayBuilderService {
  buildEmojiOverlays(words: WordSegment[], duration: number): OverlayItem[] {
    const overlays: OverlayItem[] = [];
    const addedAt = new Set<number>();

    for (const word of words) {
      for (const rule of KEYWORD_EMOJI_MAP) {
        if (rule.pattern.test(word.word)) {
          const timeKey = Math.round(word.start);
          if (addedAt.has(timeKey)) continue;
          addedAt.add(timeKey);

          const duration_w = Math.max(1, word.end - word.start);
          overlays.push({
            id: `emoji-${timeKey}`,
            type: 'EMOJI',
            start: word.start,
            end: word.start + duration_w + 0.5,
            text: rule.emoji,
            position: word.start < duration * 0.3 ? 'bottom' : word.start > duration * 0.7 ? 'top' : 'center',
            animation: 'pop',
            intensity: rule.intensity,
          });
        }
      }
    }
    return overlays;
  }

  buildSfxOverlays(words: WordSegment[]): OverlayItem[] {
    const overlays: OverlayItem[] = [];
    const addedAt = new Set<number>();

    for (const word of words) {
      for (const rule of KEYWORD_SFX_MAP) {
        if (rule.pattern.test(word.word)) {
          const timeKey = Math.round(word.start);
          if (addedAt.has(timeKey)) continue;
          addedAt.add(timeKey);

          overlays.push({
            id: `sfx-${timeKey}`,
            type: 'SFX',
            start: word.start,
            end: word.start + 1.5,
            src: rule.sfx,
            animation: 'fade',
            intensity: 'balanced',
          });
        }
      }
    }
    return overlays;
  }

  buildAll(words: WordSegment[], duration: number): OverlayItem[] {
    return [...this.buildEmojiOverlays(words, duration), ...this.buildSfxOverlays(words)];
  }
}
