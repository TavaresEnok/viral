/**
 * Opções do select de modelo, garantindo que o valor atual sempre exista entre
 * elas.
 *
 * Um <select> controlado cujo `value` não casa com nenhuma <option> exibe a
 * primeira da lista enquanto o estado continua com o valor antigo (ou vazio):
 * a tela mostrava um modelo escolhido e o save respondia "escolha um modelo".
 * A opção-espelho mantém o estado real sempre visível — vazio vira aviso e um
 * modelo fora do catálogo (config antiga, provider trocado) não some calado.
 */
export function buildModelOptions(
  catalogModels: readonly string[],
  current: string,
): Array<{ value: string; label: string }> {
  const options = catalogModels.map((m) => ({ value: m, label: m }));
  if (catalogModels.includes(current)) return options;
  return [
    {
      value: current,
      label: current ? `${current} — fora do catálogo` : '— nenhum modelo selecionado —',
    },
    ...options,
  ];
}
