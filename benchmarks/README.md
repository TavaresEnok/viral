# Benchmark de qualidade dos cortes

Este benchmark compara os intervalos produzidos pelo sistema com cortes escolhidos por revisores humanos. Ele mede qualidade real; ausência de feedback no produto não conta como aprovação.

## Protocolo recomendado

1. Selecione ao menos 50 vídeos PT-BR, distribuídos entre podcast, aula, entrevista, vendas, notícias e conteúdo motivacional.
2. Use dois revisores independentes. Cada corte de referência deve ter começo e fim completos e funcionar fora do contexto do vídeo.
3. Resolva divergências em uma revisão cega, sem mostrar os cortes do ViralForge.
4. Congele o arquivo do dataset e gere predições de cada versão do sistema.
5. Só promova uma versão se ela não regredir no F1@0.5 nem aumentar o erro médio de borda.

## Execução

```bash
corepack pnpm dataset:evaluate -- \
  --dataset benchmarks/pt-br-golden.example.json \
  --predictions benchmarks/viralforge-predictions.example.json \
  --output benchmarks/results/viralforge.json
```

`--predictions` pode ser repetido para produzir um ranking entre versões ou concorrentes avaliados com o mesmo dataset.

## Métricas

- `F1@0.5`: equilíbrio entre recuperação e precisão com sobreposição temporal mínima de 50%.
- `F1@0.7`: exige cortes mais próximos dos humanos.
- `meanBestIoU`: alinhamento médio de cada corte sugerido.
- `boundaryMaeSec`: erro médio do início e fim dos matches válidos.
- `score`: 55% F1@0.5, 25% F1@0.7 e 20% IoU médio.

