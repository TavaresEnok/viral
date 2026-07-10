# ViralForge Clips — Plano MLP

Data: 2026-05-17

Este plano move o produto de MVP funcional para MLP: mínimo produto amável, com mais controle editorial, menos atrito visual e uma experiência mais próxima de ferramentas como OpusClip, Vidyo.ai, 2short.ai e Vizard.ai.

## 1. Diagnóstico Atual

### O que já funciona

- Link do YouTube entra no fluxo principal.
- DeepSeek escolhe cortes reais e já gera múltiplos clips.
- Renderização 9:16 funciona.
- Legenda queimada já tem temas e fica no rodapé.
- Preferência de duração dos cortes existe como alvo flexível.
- Projeto pode ser reprocessado sem recriar tudo.

### Problemas de produto

- O início dos cortes está bom, mas fechamento/conclusão ainda pode ficar fraco.
- A tela de resultados usa vídeos grandes demais; o usuário precisa rolar para ver título, score, hook e motivo.
- Não existe ajuste editorial fino depois que a IA gera o corte.
- Não existe forma de trocar layout/legenda depois do clip pronto sem recriar projeto.
- A página de settings/integrations ainda parece protótipo.
- A configuração de APIs não tem ações granulares, teste de conexão, histórico ou status operacional.

## 2. Objetivo do MLP

Entregar uma ferramenta em que o usuário:

- cola um link do YouTube,
- recebe cortes virais,
- revisa rapidamente os melhores,
- ajusta início/fim sem gastar token de IA,
- muda tema de legenda/layout por clip ou por projeto,
- reprocessa só o necessário,
- baixa cortes prontos com aparência profissional.

O diferencial continua sendo encontrar bons momentos, mas o MLP precisa dar controle editorial suficiente para o usuário confiar no resultado.

## 3. Princípios Para Esta Etapa

- IA sugere; usuário decide o ajuste fino.
- Re-render não chama LLM.
- Ajustar início/fim não muda a transcrição original.
- Todo clip guarda a sugestão da IA e o recorte final escolhido pelo usuário.
- O grid de resultados deve ser escaneável antes de ser assistível.
- Configurações de API devem parecer infraestrutura de produto, não um formulário solto.
- Falha em um re-render não pode quebrar os demais clips.

## 4. Fase MLP-1 — Melhorar Qualidade de Fechamento

### Problema

A IA encontra bons começos, mas alguns cortes encerram sem conclusão forte.

### Implementação

- Atualizar prompt do analisador para exigir `closing_reason`.
- Instruir o modelo a preferir trechos que terminem com conclusão, punchline, tese fechada ou virada clara.
- Penalizar cortes que terminam no meio de raciocínio.
- Adicionar validação semântica simples no worker:
  - evitar final que termina com conectivos fracos como "porque", "então", "mas", "só que";
  - tentar expandir `end` até o próximo segmento quando couber dentro de 60s;
  - se não couber, manter corte e marcar `needsReview=true`.

### Banco

Adicionar em `Clip`:

- `suggestedStart Float`
- `suggestedEnd Float`
- `finalStart Float`
- `finalEnd Float`
- `needsReview Boolean @default(false)`
- `closingScore Int?`

### Gate

- Pelo menos 70% dos cortes terminam com ideia fechada.
- Nenhum corte termina claramente no meio de palavra/frase.
- Clips com fechamento duvidoso aparecem marcados para revisão.

## 5. Fase MLP-2 — Resultados Mais Densos

### Problema

Hoje o player 9:16 domina o card e empurra as informações para baixo.

### Nova UX

Trocar grid atual por layout de revisão:

- coluna esquerda: lista densa de clips;
- coluna direita: preview do clip selecionado;
- cada item da lista mostra:
  - score;
  - título;
  - duração;
  - categoria;
  - status;
  - hook em 1 linha;
  - botões rápidos: preview, recorte, re-render, download.

### Componentes

- `ClipReviewList`
- `ClipReviewItem`
- `ClipPreviewPanel`
- `ClipMetadataPanel`

### Comportamento

- Player grande só aparece no painel de preview.
- Cards pequenos não renderizam vídeo inline.
- Teclado:
  - seta cima/baixo troca clip selecionado;
  - espaço play/pause;
  - `R` abre recorte.

### Gate

- Usuário vê pelo menos 6 clips na tela desktop sem rolar.
- Informações principais aparecem antes do vídeo grande.
- Mobile usa lista com preview colapsável.

## 6. Fase MLP-3 — Recorte Manual com 10s de Margem

### Problema

A IA pode acertar o trecho, mas errar início/fim por poucos segundos.

### Conceito

Funcionalidade: `Recorte`

Todo clip terá uma janela editorial:

- `reviewStart = max(0, suggestedStart - 10)`
- `reviewEnd = min(videoDuration, suggestedEnd + 10)`
- usuário ajusta `finalStart` e `finalEnd` dentro dessa janela.

### UX

Abrir modal ou tela lateral:

- player com timeline curta;
- handles de início/fim;
- botões de ajuste fino:
  - `-1s`, `+1s` para início;
  - `-1s`, `+1s` para fim;
  - resetar para sugestão da IA;
- preview da duração final;
- aviso se ficar abaixo de 20s ou acima de 75s;
- botão `Salvar e re-renderizar`.

### Backend

Novas rotas:

- `PATCH /clips/:clipId/timing`
- `POST /clips/:clipId/render`
- `POST /projects/:projectId/render`

### Worker

Nova fila ou job type:

- `render-clip`
- recebe `clipId`;
- usa `finalStart/finalEnd`;
- não chama DeepSeek;
- sobrescreve ou versiona saída renderizada.

### Decisão inicial

Usar sobrescrita simples no MLP:

- substitui `clip.mp4`, `thumb.jpg`, `subtitle.srt`, `subtitle.vtt`, `subtitle.ass`;
- mantém `updatedAt`;
- no futuro pode virar versionamento.

### Gate

- Usuário ajusta início/fim e gera novo MP4 sem gastar token de IA.
- Re-render de 1 clip não muda os outros.
- Falha de re-render aparece só naquele clip.

## 7. Fase MLP-4 — Re-render de Visual e Legenda

### Problema

Hoje layout/legenda são escolhidos antes do processamento. O usuário precisa poder trocar depois.

### Escopo

Permitir editar por:

- projeto inteiro;
- clip individual.

### Campos

Em `Clip`:

- `renderLayout RenderLayout?`
- `captionTheme CaptionTheme?`

Regra:

- se `Clip.renderLayout` estiver vazio, usa `Project.renderLayout`;
- se `Clip.captionTheme` estiver vazio, usa `Project.captionTheme`.

### UI

No painel de clip:

- select de layout;
- select de legenda;
- preview textual do tema;
- botão `Re-renderizar`.

No projeto:

- botão `Aplicar modelo a todos`;
- opção de re-render em lote.

### Gate

- Trocar legenda de 1 clip e re-renderizar.
- Aplicar tema em lote sem chamar IA.
- Status de renderização aparece por clip.

## 8. Fase MLP-5 — Biblioteca de Temas Profissionais

### Objetivo

Sair de presets básicos e chegar em temas com personalidade.

### Temas iniciais

- `Clean Footer`: legenda branca discreta no rodapé.
- `Bold Yellow`: estilo creator, amarelo com outline forte.
- `Creator Box`: legenda em caixa semitransparente.
- `Minimal`: legenda pequena, limpa, sem gritar.
- `Podcast Pro`: vídeo central menor, espaço inferior para legenda.
- `Talking Head Crop`: zoom mais agressivo para rosto.

### Importante

Não copiar marcas concorrentes. Inspirar no padrão de qualidade: legibilidade, hierarquia e controle.

### Gate

- Pelo menos 4 temas visualmente distintos.
- Todos legíveis em fundo claro e escuro.
- Nenhum tema ocupa mais que 20% da altura do vídeo.

## 9. Fase MLP-6 — Settings e Integrações de Verdade

### Problema

`/dashboard/settings` ainda está fraco:

- não separa provedores;
- remove todas as chaves de uma vez;
- não testa conexão;
- não mostra último uso;
- não diferencia DeepSeek e OpenAI claramente.

### Nova Estrutura

Página: `/dashboard/settings`

Seções:

- `Integrações`
- `Processamento`
- `Segurança`
- `Diagnóstico`

### Integrações

Cards por provider:

- DeepSeek
- OpenAI Whisper

Cada card:

- status: configurada/não configurada/erro;
- chave mascarada;
- botão `Editar`;
- botão `Testar conexão`;
- botão `Remover`;
- último teste;
- último uso;
- mensagem de erro recente.

### Backend

Rotas:

- `GET /users/me/api-keys`
- `PUT /users/me/api-keys/deepseek`
- `DELETE /users/me/api-keys/deepseek`
- `POST /users/me/api-keys/deepseek/test`
- `PUT /users/me/api-keys/openai`
- `DELETE /users/me/api-keys/openai`
- `POST /users/me/api-keys/openai/test`

### Banco

Adicionar em `User` ou nova tabela `UserApiCredential`:

- `provider`
- `encryptedValue`
- `maskedValue`
- `lastTestedAt`
- `lastUsedAt`
- `lastError`

### Decisão recomendada

Criar tabela `UserApiCredential`. Evita crescer colunas em `User` para cada provider.

### Gate

- Remover só DeepSeek sem apagar OpenAI.
- Testar chave sem iniciar processamento.
- Front nunca recebe chave em texto puro.
- Erro de chave inválida aparece claro.

## 10. Fase MLP-7 — Observabilidade do Pipeline

### Problema

Quando algo falha, hoje precisamos olhar logs.

### Implementação

No banco:

- `ProcessingJob.detailsJson`
- `ProcessingJob.durationMs`
- `ProcessingJob.retryCount`

No front:

- timeline com estágio atual;
- erro técnico expansível;
- ações de retry por etapa quando fizer sentido.

### Gate

- Usuário entende se falhou em download, transcrição, IA, render ou upload.
- Erro técnico existe sem expor API key.

## 11. Fase MLP-8 — Reprocessamento Inteligente

### Tipos de reprocessamento

- `Reanalisar com IA`: gasta token, gera novos momentos.
- `Re-renderizar`: não gasta token, só muda vídeo/legenda/tempo.
- `Recriar legendas`: não gasta DeepSeek, pode usar transcript existente.
- `Refazer transcrição`: usa Whisper/OpenAI, não usa DeepSeek.

### UI

Botões devem deixar custo claro:

- `Re-renderizar` normal.
- `Reanalisar com IA` com aviso.

### Gate

- Trocar legenda não chama DeepSeek.
- Ajustar recorte não chama DeepSeek.
- Reanálise limpa clips anteriores só após confirmação.

## 12. Prioridade Recomendada

1. MLP-2: resultados densos.
2. MLP-3: recorte manual com 10s de margem.
3. MLP-4: re-render por clip sem IA.
4. MLP-6: settings/integrations.
5. MLP-1: melhora de fechamento no prompt.
6. MLP-5: biblioteca de temas.
7. MLP-7: observabilidade.
8. MLP-8: reprocessamento inteligente.

Motivo: o produto já gera cortes; agora o maior ganho percebido vem de revisão, controle e confiança.

## 13. Primeira Entrega Sugerida

### MLP Sprint 1

Escopo:

- resultados densos;
- botão `Recorte`;
- salvar `finalStart/finalEnd`;
- re-render de 1 clip;
- legenda/layout por clip;
- settings com cards básicos por provider.

Não entra:

- versionamento de render;
- editor avançado de legendas palavra por palavra;
- publicação social;
- pagamento.

### Gate

- Abrir um projeto com 9+ clips sem rolagem excessiva.
- Ajustar começo/fim de um clip com margem de 10s.
- Re-renderizar esse clip sem chamar IA.
- Trocar tema de legenda do clip e baixar novo MP4.
- Remover/testar DeepSeek e OpenAI separadamente.

## 14. Riscos

- Re-render em lote pode consumir CPU por muito tempo.
- `yt-dlp` pode baixar formatos variáveis conforme vídeo.
- Legendas do YouTube podem ter timestamps ruins.
- Editor de timeline pode virar escopo grande se tentarmos fazer precisão de frame no primeiro passo.

## 15. Decisões Técnicas Recomendadas

- Usar precisão por segundo no MLP, não por frame.
- Salvar recorte final no banco antes de renderizar.
- Manter transcript original imutável.
- Usar fila BullMQ separada ou job name separado para render individual.
- Começar com sobrescrita de arquivos renderizados.
- Criar tabela `UserApiCredential` para integrações.
- Redesenhar results page antes de criar editor avançado.

