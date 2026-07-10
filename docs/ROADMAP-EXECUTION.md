# ViralForge — Roadmap de Execução v2

**Data:** 2026-05-17  
**Status:** em execução  
**Tese:** vencer em qualidade percebida local: **corte bom + legenda premium + reframe inteligente + editor rápido + IA multimodal**.

> Este documento substitui a versão anterior de `ROADMAP-EXECUTION.md` como plano operacional.
> O documento `COMPETITIVE-ANALYSIS-AND-ROADMAP.md` continua sendo referência estratégica, mas este roadmap remove propositalmente Cloud/R2/Deploy/Billing/API pública.

---

## 0. Fora de Escopo Por Decisão

Não executar neste ciclo:

- [NAO] Cloudflare R2 / storage cloud
- [NAO] Deploy API/Worker/Web em cloud
- [NAO] Billing / Stripe / créditos / planos
- [NAO] API pública externa
- [NAO] Multi-tenant complexo
- [NAO] Auto-publicação social como dependência do core

Motivo: agora o objetivo é elevar o produto local para um nível visual e funcional superior antes de pensar em SaaS/comercialização.

---

## 1. Princípios de Execução

1. **Qualidade visual primeiro.** O usuário julga o produto pelo vídeo gerado antes de julgar qualquer arquitetura.
2. **Editor sem virar Premiere.** Ajuste fino rápido, não software de edição pesado.
3. **IA melhora o corte, não inventa complexidade.** Melhorar início, fim, hook e score antes de adicionar efeitos vazios.
4. **Toda feature precisa aparecer no vídeo final.** Se não melhora o corte gerado, fica para depois.
5. **Fallback sempre.** Remotion, face tracking e B-roll podem falhar sem quebrar render básico.
6. **Local-first.** Tudo deve rodar na stack atual local com Docker/Node/FFmpeg/Worker.

---

## 2. Estado Atual

### Já Entregue

- [x] Pipeline YouTube -> transcrição -> IA -> clips -> render -> download
- [x] BYOK com chaves criptografadas no banco
- [x] Providers múltiplos: DeepSeek, OpenRouter, Grok, Qwen, Kimi, Minimax, Google, Claude, OpenAI transcription
- [x] Settings com cards, teste de conexão, editar/remover provider
- [x] 4 layouts clássicos: blur, crop, center, top-frame
- [x] 4 temas clássicos de legenda
- [x] Recorte manual com margem de 10s
- [x] Timeline visual com handles, atalhos e re-render sem IA
- [x] Polling de render por clip
- [x] Filtros/ordenação/lista compacta de clips
- [x] Quality dashboard inicial

### Fraquezas Atuais

- [x] Legenda Remotion animada com word-level highlight inicial
- [x] Preview visual real de layouts/temas antes de processar
- [ ] Sem auto-reframe por rosto
- [ ] Virality score ainda depende demais de texto
- [ ] B-roll, emojis, SFX e overlays ainda inexistentes
- [ ] Editor de transcrição ainda não existe
- [x] Resultado visual saiu de MVP básico para base premium inicial

---

## Sprint 2 — Remotion Core + Render Engine Premium

**Prioridade:** P0  
**Duração estimada:** 1-2 semanas  
**Tese:** Remotion vira a base para legenda animada, layouts inteligentes, overlays, B-roll, stickers e temas premium.

### 2.1 — Setup Remotion no Monorepo

- [x] Criar pacote ou app interno `packages/render-engine` ou `apps/remotion`
- [x] Instalar `remotion`, `@remotion/renderer`, `@remotion/cli`
- [x] Criar composition `VerticalClip` 1080x1920 30fps
- [x] Criar props tipadas: `videoSrc`, `segments`, `words`, `theme`, `layout`, `overlays`, `durationInFrames`
- [x] Criar render headless no worker via `renderMedia()`
- [x] Manter FFmpeg como fallback automático
- [ ] Criar modo debug: renderar 5s de preview para testar tema rápido

### 2.2 — Adapter de Render

- [ ] Criar `RenderEngineService` com drivers `ffmpeg` e `remotion`
- [ ] Configuração por projeto: `renderEngine = CLASSIC | REMOTION`
- [x] Fallback: se Remotion falhar, render clássico continua
- [x] Salvar no banco qual engine gerou o clip
- [x] Salvar tempo de render por engine
- [x] Smoke test interno por clip: duração e tamanho do arquivo

### 2.3 — Video Layer Base

- [x] Componente Remotion `<VideoCanvas>`
- [ ] Layouts iniciais equivalentes aos existentes:
  - [x] `BLURRED_BACKGROUND`
  - [x] `FILL_CROP`
  - [x] `CENTER_FIT`
  - [x] `TOP_FRAME`
- [ ] Garantir áudio normalizado via FFmpeg pré/pós Remotion se necessário
- [x] Export final em H.264/AAC via Remotion/renderer

### Gate Sprint 2

- [x] Um clip renderiza por Remotion em 1080x1920
- [x] O mesmo clip ainda renderiza por FFmpeg fallback
- [x] Remotion não quebra download, subtitle, thumb nem re-render
- [x] Tempo de render medido e exibido no quality dashboard

---

## Sprint 3 — Word-Level Captions + Temas Animados Premium

**Prioridade:** P0  
**Duração estimada:** 2-3 semanas  
**Tese:** legenda é a maior diferença visual percebida. Aqui o produto começa a parecer premium.

### 3.1 — Word Timestamps

- [x] Adicionar `wordsJson` no modelo `Transcript`
- [x] Whisper: solicitar granularidade por palavra quando disponível
- [x] Para legendas do YouTube: criar alinhamento aproximado palavra-a-palavra por distribuição temporal no segmento
- [x] Criar `WordSegment { word, start, end, confidence?, segmentIndex }`
- [ ] Validar cobertura: palavras devem cobrir 90%+ do texto útil
- [x] Fallback aproximado quando word-level falhar

### 3.2 — Caption Layout Engine

- [x] Criar quebra inteligente de legenda: máximo 2 linhas
- [x] Máximo configurável de caracteres por linha
- [x] Evitar quebrar artigos/preposições no fim da linha
- [x] Posição configurável: rodapé, centro baixo, centro, topo
- [ ] Safe area vertical para não cobrir rosto/boca quando houver face tracking
- [x] Caixa de legenda com padding, radius, blur opcional

### 3.3 — Animações Word-Level

- [x] `highlight`: palavra ativa muda cor
- [x] `scale-pop`: palavra ativa cresce com bounce sutil
- [x] `karaoke`: estilo base criado
- [x] `underline-sweep`: sublinhado animado
- [x] `typewriter`: reservado no engine de tema
- [x] `pulse-glow`: glow sutil na palavra ativa
- [ ] Controle de intensidade: `subtle | balanced | loud`

### 3.4 — Temas Premium Iniciais

Criar menos temas, mas com qualidade alta:

- [x] `Bold Creator`: amarelo/branco, outline forte, scale-pop
- [x] `Clean Editorial`: caixa discreta, tipografia limpa
- [x] `Neon Tech`: glow cyan, fundo escuro, pulse controlado
- [x] `Karaoke Pro`: tema base criado
- [x] `Podcast Pro`: legenda baixa criada
- [x] `Story Impact`: texto grande centralizado para frases curtas

### 3.5 — Preview de Tema no Front

- [x] Preview estático do tema antes de criar projeto
- [ ] Preview animado curto usando amostra de texto
- [x] Seleção de tema no modal de novo projeto
- [x] Troca de tema no clip pronto + re-render sem IA
- [ ] Comparador rápido: ver 2 temas lado a lado em preview de 3s

### Gate Sprint 3

- [x] Palavra falada fica destacada corretamente
- [x] Legenda não ocupa o vídeo inteiro
- [x] Tema pode ser escolhido antes do processamento
- [x] Tema pode ser trocado depois e re-renderizado sem IA
- [ ] Resultado visual é competitivo com Submagic/Opus em legenda

---

## Sprint 4 — Smart Reframe / Face Tracking

**Prioridade:** P0  
**Duração estimada:** 2-3 semanas  
**Tese:** vídeos de podcast/aula precisam manter rosto e corpo bem enquadrados em 9:16.

### 4.1 — Face Detection Local

- [ ] Escolher implementação local: MediaPipe JS ou Python sidecar OpenCV/MediaPipe
- [ ] Extrair frames por FFmpeg em baixa resolução
- [ ] Detectar faces a cada 0.5s
- [ ] Salvar `faceTrack.json` por projeto ou clip
- [ ] Coordenadas normalizadas 0-1
- [ ] Interpolar frames sem detecção
- [ ] Cachear resultado para re-render não recalcular

### 4.2 — Smooth Crop

- [ ] Criar `SmartCropService`
- [ ] Dead-zone central para evitar micro-movimento
- [ ] Suavização por exponential moving average
- [ ] Limites para não sair do frame original
- [ ] Preferir rosto principal quando múltiplos rostos aparecem
- [ ] Fallback para blur layout quando não detectar rosto

### 4.3 — Layouts Inteligentes

- [ ] `SMART_REFRAME`: segue rosto principal
- [ ] `SMART_CENTER`: rosto no terço superior com espaço para legenda
- [ ] `SPEAKER_CLOSEUP`: crop mais fechado para impacto
- [ ] `PODCAST_SPLIT_STATIC`: duas pessoas lado a lado quando detectável
- [ ] `SCREEN_PLUS_FACE`: tela/conteúdo com face em janela menor, quando houver screen recording

### 4.4 — UI de Reframe

- [ ] Preview do enquadramento no editor de clip
- [ ] Toggle: automático/manual
- [ ] Ajuste manual do crop base quando automático erra
- [ ] Botão: recalcular face tracking
- [ ] Aviso quando não houver rosto confiável

### Gate Sprint 4

- [ ] Vídeo com 1 pessoa fica centralizado suavemente
- [ ] Podcast com 2 pessoas não corta rostos de forma grosseira
- [ ] Legenda respeita safe area do rosto
- [ ] Re-render usa cache de face tracking

---

## Sprint 5 — IA de Corte Superior: Início, Fim, Score e Mais Opções

**Prioridade:** P0/P1  
**Duração estimada:** 1-2 semanas  
**Tese:** o produto ainda depende do corte escolhido. Melhorar fim, começo e ranking vale mais que efeito visual.

### 5.1 — Prompt e Schema v2

- [x] Exigir `opening_strength`
- [x] Exigir `closing_strength`
- [x] Exigir `context_independence_score`
- [x] Exigir `shareability_reason`
- [x] Exigir `risk_of_bad_cut`: `low | medium | high`
- [x] Exigir `suggested_caption_title`
- [x] Exigir `first_three_seconds_hook`
- [x] Penalizar final inconclusivo mais agressivamente

### 5.2 — Validador Semântico Melhor

- [x] Detectar início no meio de frase
- [x] Detectar fim em conectivo fraco
- [x] Ajustar bordas para frase completa dentro da margem permitida
- [ ] Rejeitar clips com dependência forte de contexto anterior
- [x] Deduplicar por similaridade semântica, não só overlap temporal
- [x] Gerar mais candidatos que o necessário e ranquear melhor

### 5.3 — Preferência de Duração

- [x] Campo `preferredClipDuration` vira preferência, não regra rígida
- [x] Presets: `curto 20-35s`, `médio 35-55s`, `longo 55-90s`, `auto`
- [x] IA recebe duração preferencial flexível
- [x] Validação aceita variação até 90s se o fechamento for melhor
- [x] UI explica: duração ideal é guia, não obrigação

### 5.4 — Mais Opções Sem Mais Edição

- [x] Gerar 12-20 candidatos por vídeo
- [ ] Mostrar top clips e seção “extras promissores”
- [ ] Agrupar clips por tema/tópico
- [x] Evitar 5 clips falando a mesma coisa
- [ ] Botão “gerar mais cortes deste trecho” sem retranscrever

### Gate Sprint 5

- [ ] Menos cortes terminam sem conclusão
- [ ] Mais cortes começam com gancho forte nos primeiros 3s
- [ ] Score tem distribuição real, não tudo 80-95
- [ ] Usuário tem mais opções boas sem precisar editar tudo manualmente

---

## Sprint 6 — Editor de Transcrição / Text-Based Editing

**Prioridade:** P1  
**Duração estimada:** 2-3 semanas  
**Tese:** ajustes finos devem ser tão rápidos quanto editar texto.

### 6.1 — Página de Editor

- [ ] Criar `/dashboard/[id]/editor`
- [ ] Lista de clips à esquerda
- [ ] Preview do vídeo à direita
- [ ] Transcrição clicável sincronizada abaixo/centro
- [ ] Palavra/frase clicada move o player para timestamp
- [ ] Highlight da palavra atual durante playback

### 6.2 — Edição por Texto

- [ ] Selecionar trecho de texto para remover do clip
- [ ] Marcar trecho como “silêncio/corte”
- [ ] Undo/redo
- [ ] Re-render sem IA aplicando cortes internos
- [ ] Preservar legenda sincronizada após remoção

### 6.3 — Correção de Legenda

- [ ] Editar texto da legenda sem alterar áudio
- [ ] Corrigir erros de transcrição pontuais
- [x] Normalizar HTML entities e lixo textual
- [ ] Dicionário custom por usuário/projeto
- [ ] Botão “aplicar correção a todos os clips”

### 6.4 — Editor Rápido no Clip

- [ ] Modal leve de edição de legenda por clip
- [ ] Campo para título na tela
- [ ] Campo para CTA textual opcional
- [ ] Toggle de ocultar/mostrar legenda em trechos específicos

### Gate Sprint 6

- [ ] Usuário corrige uma palavra errada na legenda e re-renderiza
- [ ] Usuário remove frase interna sem IA
- [ ] Preview e transcrição ficam sincronizados
- [ ] Edição não quebra timing da legenda

---

## Sprint 7 — B-Roll, Imagens, Emojis, Stickers e SFX

**Prioridade:** P1/P2  
**Duração estimada:** 3-4 semanas  
**Tese:** efeitos só entram quando reforçam retenção. Nada de carnaval visual automático.

### 7.1 — Overlay Timeline

- [ ] Criar modelo interno `OverlayItem`
- [ ] Tipos: `TEXT`, `IMAGE`, `VIDEO`, `EMOJI`, `STICKER`, `SFX`, `CALLOUT`, `PROGRESS_BAR`
- [ ] Cada overlay tem start/end, position, animation, intensity
- [ ] Remotion renderiza overlays por camada
- [ ] UI permite ligar/desligar overlays por clip

### 7.2 — Auto-Emoji / Sticker

- [ ] LLM sugere emojis por segmento
- [ ] Limite de frequência para não poluir
- [ ] Animações: pop, float, bounce, slide
- [ ] Paleta visual por tema
- [ ] Gate: emojis ajudam, não parecem meme ruim

### 7.3 — B-Roll Local/Manual Primeiro

- [ ] Biblioteca local de assets do usuário
- [ ] Upload/import de imagens e vídeos curtos
- [ ] Associar asset a palavra/frase da transcrição
- [ ] Inserir B-roll manualmente no editor
- [ ] Depois: sugestão automática via LLM

### 7.4 — B-Roll Automático

- [ ] Identificar entidades/conceitos por segmento
- [ ] Buscar assets locais primeiro
- [ ] Opcional: integrar Pexels/Pixabay depois, via provider configurável
- [ ] Inserir no máximo 1-2 B-rolls por clip
- [ ] Sempre permitir remover antes de render final

### 7.5 — SFX Controlado

- [ ] Biblioteca local de SFX: whoosh, pop, ding, impact, riser
- [ ] Mapear SFX para momentos fortes
- [ ] Volume baixo por padrão
- [ ] Toggle global: sem SFX / sutil / intenso
- [ ] Gate: SFX não compete com fala

### Gate Sprint 7

- [ ] Overlay aparece sincronizado no vídeo final
- [ ] Usuário consegue remover overlay ruim
- [ ] B-roll manual funciona antes do automático
- [ ] Automação visual não degrada legibilidade

---

## Sprint 8 — Brand Kit Local + Templates de Projeto

**Prioridade:** P1  
**Duração estimada:** 2 semanas  
**Tese:** criador quer consistência visual sem configurar tudo a cada vídeo.

### 8.1 — Brand Kit

- [ ] Modelo `BrandKit`
- [ ] Nome, logo, watermark, cores, fonte preferida
- [ ] Upload local de logo
- [ ] Posição de watermark
- [ ] Opacidade de watermark
- [ ] Aplicar brand kit em temas Remotion

### 8.2 — Templates de Projeto

- [ ] Criar presets salvos: idioma, estilo, duração, layout, tema, overlays, reframe
- [ ] Template padrão do usuário
- [ ] Duplicar projeto usando template anterior
- [ ] “Usar configurações do último vídeo”

### 8.3 — Presets por Nicho

- [ ] Podcast sério
- [ ] Cortes polêmicos
- [ ] Aula/educacional
- [ ] Vendas/oferta
- [ ] Motivacional
- [ ] React/live
- [ ] Sermão/palestra
- [ ] Canal dark/documentário

### Gate Sprint 8

- [ ] Usuário cria brand kit e ele aparece no vídeo
- [ ] Novo projeto pode usar template salvo
- [ ] Re-render aplica brand kit sem IA

---

## Sprint 9 — UX Premium de Resultados

**Prioridade:** P1  
**Duração estimada:** 1-2 semanas  
**Tese:** a tela de resultados precisa parecer cockpit de criação, não lista de arquivos.

### 9.1 — Layout de Resultados 2 Colunas

- [x] Lista compacta de clips à esquerda
- [x] Preview grande à direita
- [x] Métricas/hook/reason abaixo do preview
- [ ] Edição rápida em tabs: Recorte, Legenda, Visual, Export
- [x] Miniaturas nos project cards quando existe thumbnail

### 9.2 — Comparação e Seleção

- [ ] Marcar favoritos
- [ ] Ocultar rejeitados
- [ ] Comparar dois clips lado a lado
- [ ] Agrupar por tema/tópico
- [ ] Badge “melhor gancho”, “melhor fechamento”, “mais emocional”

### 9.3 — Export Local Melhor

- [x] Baixar clip individual
- [ ] Baixar legenda `.srt/.vtt/.txt`
- [x] Baixar/servir thumbnail via endpoint protegido
- [ ] Baixar pacote ZIP local do projeto
- [x] Nome de arquivo limpo e consistente

### Gate Sprint 9

- [ ] Menos scroll para revisar clips
- [ ] Usuário consegue decidir quais baixar em menos tempo
- [ ] Resultado parece produto premium

---

## Sprint 10 — Quality Dashboard 2.0 e Feedback Loop

**Prioridade:** P1  
**Duração estimada:** 1-2 semanas  
**Tese:** melhorar IA sem métricas vira chute.

### 10.1 — Métricas por Projeto

- [ ] Tempo por etapa: download, transcrição, análise, render
- [ ] Quantidade de candidatos da IA vs clips aprovados
- [ ] Distribuição de scores
- [ ] Distribuição de closing/opening strength
- [ ] Taxa de clips re-renderizados
- [ ] Taxa de clips baixados

### 10.2 — Feedback Manual

- [ ] Botão “bom corte”
- [x] Botão “corte ruim” com motivo
- [x] Motivos: começo ruim, fim ruim, sem contexto, não viral, legenda ruim
- [ ] Campo opcional de observação
- [ ] Dataset local exportável em JSON/CSV

### 10.3 — Avaliação Comparativa

- [ ] Rodar mesmo vídeo com prompt/modelo A e B
- [ ] Comparar clips gerados lado a lado
- [ ] Métrica: quais foram baixados/favoritados
- [ ] Histórico de versões de prompt
- [ ] Botão “promover prompt vencedor”

### Gate Sprint 10

- [ ] É possível saber onde o pipeline está lento
- [ ] É possível saber por que clips foram rejeitados
- [ ] É possível comparar prompt/modelo com dados reais locais

---

## Sprint 11 — Multi-Model Intelligence / Router de IA

**Prioridade:** P1/P2  
**Duração estimada:** 2 semanas  
**Tese:** não ficar preso a um modelo. Usar DeepSeek/OpenRouter/Gemini/Qwen/etc conforme tarefa.

### 11.1 — Model Router

- [ ] Configurar provider por tarefa:
  - [ ] Clip analyzer
  - [ ] Title generator
  - [ ] Caption cleanup
  - [ ] B-roll suggestion
  - [ ] Emoji/SFX suggestion
  - [ ] Prompt evaluator
- [ ] Fallback automático se provider falhar
- [x] Teste de conexão por modelo, não só provider
- [ ] Mostrar custo estimado quando provider informar uso

### 11.2 — Prompt Lab

- [ ] Página `/dashboard/settings/prompts` ou `/dashboard/lab`
- [ ] Editar prompt system/user por tarefa
- [ ] Versionar prompt localmente
- [ ] Rodar prompt contra transcript existente sem reprocessar vídeo
- [ ] Comparar respostas lado a lado
- [ ] Restaurar prompt padrão

### 11.3 — Auto-Evaluator

- [ ] Usar segundo modelo para avaliar cortes do primeiro
- [ ] Critérios: hook, fechamento, contexto, emoção, redundância
- [ ] Score composto com auditoria
- [ ] Mostrar “por que subiu/desceu no ranking”

### Gate Sprint 11

- [ ] Usuário escolhe modelo por tarefa
- [ ] Prompt pode ser testado sem rodar vídeo inteiro
- [ ] Fallback entre providers funciona

---

## Sprint 12 — Thumbnail, Título e Pacote de Publicação Manual

**Prioridade:** P2  
**Duração estimada:** 2 semanas  
**Tese:** mesmo sem auto-publicação, entregar pacote pronto para postar.

### 12.1 — Thumbnails Premium

- [ ] Gerar 3 thumbnails por clip
- [ ] Frame mais expressivo por face/expression score
- [ ] Texto curto opcional na thumb
- [ ] Template de thumbnail por brand kit
- [ ] Download individual da thumb

### 12.2 — Copy Pack

- [ ] Gerar título por plataforma
- [ ] Descrição curta
- [ ] Hashtags
- [ ] Primeiro comentário sugerido
- [ ] CTA sugerido
- [ ] Copiar tudo em um clique

### 12.3 — Export Presets

- [ ] TikTok
- [ ] Reels
- [ ] Shorts
- [ ] LinkedIn vertical
- [ ] Stories
- [ ] Configurar bitrate/resolução por preset

### Gate Sprint 12

- [ ] Usuário baixa vídeo + thumb + texto pronto
- [ ] Pacote manual reduz trabalho fora do app

---

## Sprint 13 — Performance Local e Robustez

**Prioridade:** contínua  
**Duração estimada:** 1-2 semanas dedicadas após Sprints 3/4

### 13.1 — Pipeline Incremental

- [ ] Mostrar clips assim que cada um fica pronto
- [ ] Não esperar todos renderizarem para mostrar o primeiro
- [ ] Priorizar render dos top 3 clips primeiro
- [ ] Cancelar render de clips extras
- [ ] Reordenar fila local por score

### 13.2 — Cache Inteligente

- [ ] Cache de download YouTube por URL
- [ ] Cache de transcrição por hash do áudio
- [ ] Cache de faceTrack por hash de vídeo
- [ ] Cache de word alignment
- [ ] Re-render não recalcula etapas anteriores

### 13.3 — Robustez de YouTube

- [ ] Melhorar mensagens de erro do yt-dlp
- [ ] Fallback de upload manual sempre visível
- [ ] Retry com atualização de yt-dlp recomendada
- [ ] Detectar vídeo indisponível/privado/idade/região

### Gate Sprint 13

- [ ] Primeiro clip aparece antes do projeto terminar inteiro
- [ ] Re-render fica significativamente mais rápido
- [ ] Falhas de YouTube são claras para o usuário

---

## Ordem Recomendada de Execução

| Ordem | Sprint | Por quê |
|---|---|---|
| 1 | Sprint 2 — Remotion Core | Base técnica para tudo visual |
| 2 | Sprint 3 — Word-Level Captions | Maior salto visual imediato |
| 3 | Sprint 4 — Smart Reframe | Elimina maior gap contra Opus/Vidyo |
| 4 | Sprint 5 — IA de Corte Superior | Melhora o produto central: achar bons momentos |
| 5 | Sprint 9 — UX Premium Resultados | Faz o usuário sentir produto profissional |
| 6 | Sprint 6 — Text-Based Editing | Ajuste fino rápido sem virar editor pesado |
| 7 | Sprint 8 — Brand Kit/Templates | Consistência visual para criadores reais |
| 8 | Sprint 10 — Quality Dashboard 2.0 | Medir e melhorar com dados |
| 9 | Sprint 11 — Multi-Model Router | Liberdade real de modelo/provedor |
| 10 | Sprint 7 — B-Roll/Overlays/SFX | Diferenciação visual, depois do core sólido |
| 11 | Sprint 12 — Pacote de Publicação | Ajuda postagem manual sem integrar redes |
| 12 | Sprint 13 — Performance Local | Otimização contínua e robustez |

---

## Métricas de Aprovação

### Alpha Visual

- [x] Legenda animada word-level funcionando
- [x] 3+ temas premium realmente usáveis
- [ ] Smart reframe básico funcionando
- [ ] Resultado visual comparável a ferramentas pagas em pelo menos 1 tipo de vídeo

### Alpha de Produto

- [x] Usuário consegue gerar clips, ajustar, re-renderizar e baixar sem ajuda
- [x] Duração/corte/tema/layout podem ser alterados sem gastar IA
- [ ] Feedback de erro claro quando algo falha
- [ ] Primeiro clip pronto aparece antes do fim completo do projeto

### Alpha de Qualidade IA

- [ ] 70%+ dos top clips têm começo forte
- [ ] 70%+ dos top clips têm fechamento natural
- [ ] Score distribui clips de forma útil
- [ ] Menos redundância entre clips

---

## Decisões Pendentes Para Aprovação

1. Confirmar se começamos pelo **Sprint 2 — Remotion Core**.
2. Confirmar se o render premium deve virar default assim que estiver estável, mantendo FFmpeg só como fallback.
3. Confirmar se o primeiro objetivo visual é competir mais com **Submagic** em legenda ou com **Opus Clip** em auto-reframe.
