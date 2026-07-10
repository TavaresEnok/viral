import { describe, expect, it } from 'vitest';
import {
  languageOptions,
  captionThemeOptions,
  renderLayoutOptions,
} from './project-options';

// Faixas Unicode de scripts não-latinos: cirílico, árabe, kana, CJK, hangul,
// devanagari. Checadas por code point (sem regex literal) p/ não esbarrar em
// regras de lint de "caractere combinado / espaço irregular".
const NON_LATIN_RANGES: Array<[number, number]> = [
  [0x0400, 0x04ff],
  [0x0600, 0x06ff],
  [0x3040, 0x30ff],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7af],
  [0x0900, 0x097f],
];

function hasNonLatinScript(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (NON_LATIN_RANGES.some(([lo, hi]) => code >= lo && code <= hi)) return true;
  }
  return false;
}

describe('project-options', () => {
  it('oferece 4 estilos de legenda e 4 layouts (UI simplificada)', () => {
    expect(captionThemeOptions).toHaveLength(4);
    expect(renderLayoutOptions.filter((o) => !o.comingSoon)).toHaveLength(4);
  });

  it('mantém pt-BR como primeiro/padrão de idioma', () => {
    expect(languageOptions[0]?.value).toBe('pt-BR');
  });

  it('só oferece idiomas de escrita latina (fontes das legendas não têm CJK/árabe/cirílico)', () => {
    // As fontes Arial/Impact só têm glifos latinos — outro script renderizaria
    // legenda como tofu. Bloqueado até o engine ganhar fonte com esses glifos.
    for (const lang of languageOptions) {
      expect(hasNonLatinScript(lang.label), `label "${lang.label}" fora do latino`).toBe(false);
    }
    const blocked = ['ja', 'zh', 'ko', 'ar', 'hi', 'ru', 'uk', 'el', 'th', 'he'];
    const offered = languageOptions.map((l) => l.value.split('-')[0]);
    expect(offered.filter((code) => blocked.includes(code))).toHaveLength(0);
  });

  it('não tem códigos de idioma duplicados', () => {
    const values = languageOptions.map((l) => l.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
