import { describe, it, expect } from 'vitest';

// Inline the keyword maps so tests don't import NestJS decorators

const KEYWORD_EMOJI_MAP: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /\b(incr[ií]vel|uau|nossa|caramba|nunca|jamais|absurdo|impressionante|genial|fenomenal)\b/i, emoji: '😱' },
  { pattern: /\b(fogo|pegando|quente|viral|explodiu|bomba|hype)\b/i, emoji: '🔥' },
  { pattern: /\b(rindo|risos|haha|kkkk|hue|morri|engraçado|hilário|piada)\b/i, emoji: '😂' },
  { pattern: /\b(recorde|top|primeiro|número\s*1|melhor|maior|lenda|goat|mito)\b/i, emoji: '🏆' },
  { pattern: /\b(dinheiro|fatura|receita|milhão|bilhão|lucro|rico|grana)\b/i, emoji: '💰' },
  { pattern: /\b(festa|balada|celebra|comemora|party|parabéns)\b/i, emoji: '🎉' },
  { pattern: /\b(força|determinação|foco|disciplina|garra|persistência|vencer)\b/i, emoji: '💪' },
];

const KEYWORD_SFX_MAP: Array<{ pattern: RegExp; sfx: string }> = [
  { pattern: /\b(uau|nossa|caramba|incr[ií]vel|genial|fenomenal)\b/i, sfx: 'wow' },
  { pattern: /\b(rindo|risos|haha|kkkk|hue|engraçado|hilário)\b/i, sfx: 'laugh' },
  { pattern: /\b(fogo|pegando|quente|explodiu|bomba)\b/i, sfx: 'fire' },
  { pattern: /\b(vitória|ganhou|recorde|vencer|top|primeiro)\b/i, sfx: 'success' },
];

function matchesEmoji(word: string): string | null {
  for (const rule of KEYWORD_EMOJI_MAP) {
    if (rule.pattern.test(word)) return rule.emoji;
  }
  return null;
}

function matchesSfx(word: string): string | null {
  for (const rule of KEYWORD_SFX_MAP) {
    if (rule.pattern.test(word)) return rule.sfx;
  }
  return null;
}

describe('OverlayBuilderService emoji matching', () => {
  it('detects fire emoji for "fogo"', () => {
    expect(matchesEmoji('fogo')).toBe('🔥');
  });

  it('detects fire emoji for "viral"', () => {
    expect(matchesEmoji('viral')).toBe('🔥');
  });

  it('detects trophy emoji for "recorde"', () => {
    expect(matchesEmoji('recorde')).toBe('🏆');
  });

  it('detects laugh emoji for "kkkk"', () => {
    expect(matchesEmoji('kkkk')).toBe('😂');
  });

  it('detects wow emoji for "incrível"', () => {
    expect(matchesEmoji('incrível')).toBe('😱');
  });

  it('returns null for neutral word', () => {
    expect(matchesEmoji('carro')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(matchesEmoji('FOGO')).toBe('🔥');
    expect(matchesEmoji('Viral')).toBe('🔥');
  });
});

describe('OverlayBuilderService SFX matching', () => {
  it('detects wow SFX for "caramba"', () => {
    expect(matchesSfx('caramba')).toBe('wow');
  });

  it('detects fire SFX for "explodiu"', () => {
    expect(matchesSfx('explodiu')).toBe('fire');
  });

  it('detects success SFX for "vencer"', () => {
    expect(matchesSfx('vencer')).toBe('success');
  });

  it('returns null for neutral word', () => {
    expect(matchesSfx('mesa')).toBeNull();
  });
});
