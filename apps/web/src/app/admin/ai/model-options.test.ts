import { describe, expect, it } from 'vitest';
import { buildModelOptions } from './model-options';

/**
 * Regressão real: o banco ficou com `llmModel` vazio e o select, sem nenhuma
 * <option> de valor vazio, exibia o primeiro modelo do catálogo. A tela dizia
 * que havia um modelo escolhido enquanto o estado estava vazio, e o save
 * respondia "escolha um modelo" — parecendo um bug do save, não da tela.
 */
describe('buildModelOptions', () => {
  const catalogo = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];

  it('o valor atual sempre existe entre as opções', () => {
    for (const atual of ['', 'gemini-3.6-flash', 'gemini-2.5-flash']) {
      const valores = buildModelOptions(catalogo, atual).map((o) => o.value);
      expect(valores).toContain(atual);
    }
  });

  it('modelo vazio aparece como aviso, não como um modelo real', () => {
    const [primeira] = buildModelOptions(catalogo, '');
    expect(primeira.value).toBe('');
    expect(primeira.label).toMatch(/nenhum modelo/i);
  });

  it('modelo fora do catálogo é preservado e sinalizado', () => {
    const [primeira] = buildModelOptions(catalogo, 'gemini-2.5-flash');
    expect(primeira.value).toBe('gemini-2.5-flash');
    expect(primeira.label).toMatch(/fora do catálogo/i);
  });

  it('não inventa opção quando o modelo já está no catálogo', () => {
    const opcoes = buildModelOptions(catalogo, 'gemini-3.6-flash');
    expect(opcoes).toHaveLength(catalogo.length);
  });
});
