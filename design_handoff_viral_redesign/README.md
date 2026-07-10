# Handoff: Redesign completo do Viral (ViralForge)

## Overview
Redesign completo da interface do **Viral** — SaaS de IA que transforma vídeos longos (link do YouTube ou upload) em cortes verticais 9:16 prontos para TikTok, Reels, Shorts e Kwai. O objetivo do redesign é abandonar o visual "enterprise" atual (teal + Inter + hairlines minimalistas) por uma identidade **creator-first**: dark-first, lime elétrico, tipografia display pesada e copy jovem em PT-BR.

O redesign cobre: Landing, Login, Dashboard (projetos), fluxo Novo corte (3 passos), Processamento, Resultados (grid de clips), Editor de clip, Desempenho (analytics), Templates, Brand kit, Postagens e Plano (billing).

## About the Design Files
Os arquivos neste pacote são **referências de design criadas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar estes designs no codebase existente** (`apps/web` — Next.js App Router + Tailwind CSS + componentes em `src/components`), usando os padrões já estabelecidos: tokens CSS em `globals.css`, mapeamento RGB no `tailwind.config.ts`, componentes `Button`, `Badge`, `Modal`, etc.

- `Viral Redesign.dc.html` — protótipo interativo com todas as telas (abre no navegador; navegação pela sidebar e pelas pílulas "telas" no canto inferior direito)
- `Design System Viral.dc.html` — página de especificação dos tokens, tipografia, componentes e copy

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, raios e copy são finais. Recriar a UI fielmente usando a infraestrutura existente do codebase. Os dados exibidos (títulos de projetos, scores, métricas) são mock.

---

## Design Tokens

### Cores — tema escuro (padrão)
| Token (nome existente em globals.css) | Novo valor | Era |
|---|---|---|
| `--bg-base` | `#0C0C11` | `#0A0A0A` |
| `--bg-surface` | `#14141B` | `#111111` |
| `--bg-elevated` | `#1C1C26` | `#161616` |
| `--hairline-subtle` | `#26262F` | `#1F1F1F` |
| `--hairline-strong` | `#37373F` | `#2A2A2A` |
| `--ink-primary` | `#F4F4F6` | `#FAFAFA` |
| `--ink-secondary` | `#A6A6B2` | `#A1A1AA` |
| `--ink-tertiary` | `#6E6E7A` | `#71717A` |
| `--accent` | `#C8F542` (lime) | `#14B8A6` (teal) |
| `--accent-hover` | `#D6FF55` | `#2DD4BF` |
| `--accent-glow` | `rgba(200,245,66,.20)` | teal glow |
| **novo** `--accent-text` | `#D6FF55` (texto lime sobre fundo escuro) | — |
| **novo** `--on-accent` | `#10120A` (texto sobre fundo lime) | — |
| **novo** `--special` | `#FF4FA3` (magenta — só gradientes/acentos raros) | — |

### Cores — tema claro (classe `.light`)
| Token | Valor |
|---|---|
| `--bg-base` | `#F2F2EC` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-elevated` | `#E9E9E0` |
| `--hairline-subtle` | `#E0E0D5` |
| `--hairline-strong` | `#C9C9BD` |
| `--ink-primary` | `#15151A` |
| `--ink-secondary` | `#5C5C66` |
| `--ink-tertiary` | `#94949E` |
| `--accent` | `#C8F542` (igual — só como **fundo** com texto `#10120A`) |
| `--accent-text` | `#587F00` (texto/borda lime sobre fundo claro) |
| `--special` | `#E0337F` |

**Regra de ouro:** lime é a ÚNICA cor de ação (botão primário, score, seleção, estado ativo). Magenta aparece apenas em gradientes de progresso (`linear-gradient(90deg, lime, magenta)`) e no avatar. Status: publicado = lime, agendado = `#FFC24B`, falhou/erro = `#FF6B6B`.

### Tipografia (Google Fonts — trocar no `layout.tsx` via next/font)
| Papel | Fonte | Pesos | Uso |
|---|---|---|---|
| Display/títulos | **Bricolage Grotesque** | 700, 800 | h1–h3, nomes de cards, wordmark. letter-spacing −0.02 a −0.03em |
| UI/corpo | **Instrument Sans** | 400–700 | tudo o resto (substitui Inter) |
| Mono | **Spline Sans Mono** | 500, 700 | scores, timestamps, kickers em caps (tracking .1–.16em), labels técnicos |

Escala: display 42–84px · h2 28–36px · h3 16–20px · body 14–15px · caption 12–13px · micro/kicker 10–12px (mono, uppercase).

### Forma
- **Tudo clicável é pill** (`border-radius: 999px`): botões, chips, toggles, badges
- Cards e superfícies: raio **18–20px**; inputs: **14px**; mini-previews: 9–12px
- Profundidade por **borda 1px + glow lime** (`box-shadow: 0 0 0 4px var(--accent-glow)`) em destaques; sem sombras pesadas
- Cards selecionáveis: borda `1.5px` lime + fundo `--accent-glow` quando ativos

### Botões (refatorar `src/components/ui/Button.tsx`)
- **Primário**: h 46px (36px compacto), pill, `bg-accent`, texto `#10120A`, weight 700, hover `brightness(1.08)`
- **Secundário**: pill, transparente, borda `--hairline-strong`, texto `--ink-primary`
- **Tonal**: pill, `bg-elevated`, sem borda
- **Ghost**: sem fundo/borda, texto `--ink-secondary`
- **Danger**: `rgba(255,79,90,.12)` + borda `rgba(255,79,90,.35)` + texto `#FF8A8A`

---

## Screens / Views

> Layouts de referência: ver o protótipo. Medidas principais abaixo. Container do app: sidebar fixa 248px + main fluido; conteúdo `max-width` 900–1280px conforme tela, padding lateral 28px.

### 1. Landing (`/`)
- Nav: logo (quadrado 34px lime com play preto + wordmark "viral." Bricolage 800 22px), links, botão "Criar grátis" primário
- Hero centrado: badge mono pulsante "feito para creators BR", display `clamp(44px,6.4vw,84px)` com "cortes que estouram" em lime-text, sub 19px, **input-pill de link** (fundo surface, pill, botão "Gerar cortes" embutido à direita), nota mono "grátis · sem cartão · 5 vídeos por mês"
- 3 celulares 9:16 (170px) flutuando com tilt −7°/0°/7°, animação float 5–6s, cada um com badge de score "▲ 9x", legenda estilo creator (Bricolage 800 uppercase, text-shadow 2px 2px 0 #000) e barra de progresso lime
- **Marquee** full-width fundo lime, texto `#10120A` Bricolage 800 uppercase: "Podcast → 12 cortes ✦ Live → 8 cortes…" (translateX −50%, 22s loop)
- "Do link ao post em 3 passos": 3 cards numerados (mono lime "01")
- Preços: Free R$0 vs Pro R$79/mês (card Pro com borda lime + glow + tag "mais usado")

### 2. Login (`/login`)
Split 50/50: painel esquerdo **fundo lime sólido** com logo invertido e display `#10120A` "O algoritmo ama quem posta todo dia."; direito: form (inputs 48px raio 14px, focus borda lime), botão primário "Entrar no estúdio".

### 3. Shell do app (sidebar + header)
- **Sidebar 248px**, fundo surface, borda direita hairline: logo, botão primário full-width "+ Novo corte", nav com itens de 42px (marker = losango 8px, lime quando ativo; item ativo: fundo elevated): **Cortes, Desempenho, Templates, Brand kit, Postagens, Plano**; rodapé: card de quota (Plano Free, "3/5", barra gradiente lime→magenta, botão "Virar Pro" invertido) + usuário (avatar gradiente magenta→lime)
- **Header 64px**: título da tela (Bricolage 700 18px), toggle de tema (pill mono "LIGHT/DARK" com dot), botão compacto "+ Novo corte"

### 4. Dashboard — Cortes (`/dashboard`)
- Kicker mono lime "seu estúdio", display 42px "Seus cortes", linha de stats: "6 vídeos · 45 cortes gerados · melhor score do mês: 96"
- Busca pill à direita
- Grid `repeat(auto-fill, minmax(290px,1fr))`, gap 18px. **Primeiro item = card dashed "Mandar vídeo novo"** (borda 1.5px dashed, círculo lime 52px com +)
- Card de projeto: thumb 16:9 (gradiente escuro + stripes de placeholder), badge de status pill no canto sup. esquerdo ("pronto" preto translúcido com texto lime / "processando" lime sólido), duração mono no inf. direito, barra de progresso quando processando; corpo: título Bricolage 700 16px (2 linhas), meta, badge "▲ 96" pill, "12 cortes prontos" + tempo relativo mono. Hover: borda strong + translateY(−2px)

### 5. Novo corte (3 passos — substituir o modal atual por página)
- Stepper: 3 botões-pill largos "01 Conteúdo / 02 Estratégia / 03 Visual" (ativo: borda lime + fundo glow)
- **Passo 1**: h2 "De onde vem o vídeo?", 2 cards de fonte (Link do YouTube / Upload de arquivo — seleção com borda lime 1.5px), input nome, input link mono OU dropzone dashed
- **Passo 2**: h2 "O que a IA deve caçar?", chips pill de tipo (Podcast, Entrevista, Aula, Live…) e estilo (Alta retenção, Educativo, Polêmico…) — selecionado = pill lime preenchida; 4 cards de duração (Auto/Curto/Médio/Longo) + nota sobre fechamento natural
- **Passo 3**: h2 "Como vai ficar na tela?", grid 5 layouts (mini-preview 9:16 desenhado com retângulos: fundo desfocado, crop total, split podcast, tela+rosto, centralizado) + grid 6 estilos de legenda (preview com texto estilizado real) + **rail direito sticky** com preview 9:16 grande + resumo das seleções
- Rodapé: "Cancelar/← Voltar" à esquerda; "Continuar →" ou **"Mandar pra fila ✦"** (primário com glow) à direita

### 6. Processamento
- Grid `1fr 340px`. Esquerda: badge pulsante "processando", display "A IA tá caçando seus melhores momentos", card de progresso (título da etapa + % mono 28px lime + barra gradiente lime→magenta 10px), lista de 6 etapas (Baixando → Transcrevendo → Caçando momentos → Cortando 9:16 → Queimando legenda → Renderizando; etapa ativa: borda lime + glow, concluída: dot lime com ✓)
- Ao concluir: **banner lime** "12 cortes prontos!" + botão invertido "Ver meus cortes →"
- Direita: celular 9:16 280px com linha de scan animada, ondas de transcrição, legenda "Caçando o gancho…", 3 mini-clips pulsando
- Nota: "Pode fechar essa página — a gente continua trabalhando."

### 7. Resultados
- "← Todos os vídeos", meta mono, display 36px com título do projeto, sub "12 momentos encontrados. Baixa, edita ou posta direto."
- Card lateral: "top score" + número Bricolage 44px lime + botões "Baixar todos" (primário) e "Exportar p/ editor" (secundário — mantém exports Premiere XML / DaVinci EDL existentes)
- Filtros pill: Todos / Score 90+ / Até 45s
- Grid `minmax(250px,1fr)` de **clip cards 9:16**: preview com gradiente + stripes, badge "▲ score" (lime-text se ≥90), duração mono, botão play central 52px translúcido, legenda estilo creator, barra lime; corpo: título Bricolage 14px + categoria mono, hook em itálico, 3 botões: **Baixar** (primário) / Editar / Postar (secundários)

### 8. Editor de clip
- Top bar: "← Cortes", título + badge score, "Postar agora" (secundário) + "Baixar MP4" (primário)
- Grid `330px 1fr`: celular 9:16 300px (legenda renderizada com estilo/tamanho/posição selecionados, play central, barra lime)
- Tabs pill segmentadas: **Legenda / Layout / Corte** (ativa = pill lime)
  - Legenda: 6 estilos (Bold Creator, Karaokê, Caixa preta, Neon, Minimal, Editorial) com preview real; Tamanho P/M/G; Posição Topo/Centro/Base — tudo refletido no preview ao vivo
  - Layout: os mesmos 5 layouts do passo 3
  - Corte: cards mono entrada `14:32.4` / saída `15:14.8` / duração `0:42` (duração com borda lime + glow) + botão "✦ Regenerar corte com IA"
- Abaixo: card "timeline do vídeo original" (segmentos em barra, trecho selecionado = lime) + "transcrição do trecho" (palavras com highlight lime no trecho do corte)

### 9. Desempenho (`/dashboard/analytics`)
Kicker "raio-x do canal". 4 KPIs (score médio 86/100 em lime-text, cortes gerados, taxa de download, rejeitados). Grid `1.4fr 1fr`: gráfico de barras "Distribuição de score viral" (buckets 50–59…90–100; bucket 90–100 = lime, demais = `--hairline-strong`; altura proporcional, contagem mono em cima de cada barra) + card "Top cortes do mês" (rank mono, título, downloads, badge score). Nota explicando o score.

### 10. Templates (`/dashboard/templates`)
Header + botão "+ Novo template". Grid de cards: mini-preview 9:14 (layout + legenda reais), nome Bricolage, 2 tags pill mono (layout · legenda), "Usar agora" (primário, pré-preenche o fluxo Novo corte) + botão ✕. Último card: dashed "Criar do zero".

### 11. Brand kit (`/dashboard/brand`)
Grid `1fr 300px`. Esquerda: card logo/marca d'água (dropzone dashed com stripes "solta seu PNG aqui"), card cores da marca (swatches 46px raio 14px com hex mono + botão dashed +), card fonte das legendas (3 opções com sample "ISSO MUDA TUDO" na própria fonte; ativa = borda lime). Direita sticky: preview 9:16 com marca d'água "@handle" pill posicionada + legenda na fonte escolhida; picker 2×2 de posição (Sup./Inf. × esquerda/direita).

### 12. Postagens (`/dashboard/published`)
Lista de rows (raio 18px): mini-thumb 42×74, título Bricolage 15px, chip da plataforma (TikTok/YT Shorts/Reels/Kwai) + horário mono; status com dot colorido (Publicado lime / Agendado `#FFC24B` / Falhou `#FF6B6B`); botão "abrir ↗".

### 13. Plano (`/dashboard/billing`)
Grid 2 colunas: card do plano atual (Free R$0, barra de uso 3/5 com gradiente lime→magenta, "renova em…", features, "Sem faturas ainda") + card Pro (borda lime + glow, tag "recomendado", R$79/mês, CTA primário "Virar Pro agora"). Manter integração Stripe existente nos CTAs.

---

## Interactions & Behavior
- **Hover**: botões primários `filter: brightness(1.08)`; cards `border-color: hairline-strong` + `translateY(-2px)`; transições 150–220ms
- **Seleção** (chips/cards): pill/card preenchido lime OU borda 1.5px lime + fundo glow — sempre instantâneo, sem animação de layout
- **Progresso**: barras sempre `linear-gradient(90deg, #C8F542, #FF4FA3)`, pill, fundo `--bg-elevated`
- **Processamento**: polling existente (`useProjectPolling`) alimenta % e etapa; etapas derivadas do progresso como hoje (`stageCopy`); ao completar, mostrar banner lime com CTA em vez de redirect automático
- **Animações decorativas**: blink de dot (1.4–1.6s), float dos celulares na landing (5–6s ease-in-out), scan line no processamento (3.2s linear), marquee (22s linear). Respeitar `prefers-reduced-motion` (já existe no globals.css)
- **Tema**: toggle no header alterna classe `.light` no root (mecanismo atual mantido)
- **Fluxo**: Dashboard → card dashed ou "+ Novo corte" → página de 3 passos → "Mandar pra fila ✦" → Processamento → "Ver meus cortes →" → Resultados → "Editar" → Editor

## State Management
Sem mudanças de arquitetura: manter React Query + Zustand existentes. Mudanças de UI-state: o modal `NewProjectModal` vira página/rota com os mesmos campos (`sourceMode`, `title`, `youtubeUrl`/`file`, `language`, `contentType`, `clipStyle`, `durationPreset`, `renderLayout`, `captionTheme`); editor ganha `capSize` (P/M/G) e `capPos` (Topo/Centro/Base) — mapear para os parâmetros de render existentes; brand kit ganha `brandFont` e `wmPos`.

## Copy (antes → depois)
| Antes | Depois |
|---|---|
| Novo projeto | **Novo corte** |
| Criar e processar | **Mandar pra fila ✦** |
| Estamos transformando o vídeo em momentos prontos para postar. | **A IA tá caçando seus melhores momentos** |
| X momentos pontuados este mês | **45 cortes gerados · melhor score: 96** |
| Analytics / Cobrança / Publicações | **Desempenho / Plano / Postagens** |
| Upload fallback · contingência operacional | **Upload de arquivo · direto do seu computador** |
| Força do Momento | **score viral** |

Tom: direto, segunda pessoa, vocabulário de creator, benefício antes do processo. Sem emoji (✦ e ▲ são glifos tipográficos, não emoji).

## Assets
- Nenhuma imagem externa. Thumbs/previews no protótipo são **placeholders** (gradientes escuros + stripes `repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 10px, transparent 10px 20px)`) — em produção são as thumbnails reais dos clips
- Logo: quadrado arredondado lime com triângulo de play `#10120A` + wordmark "viral." em Bricolage Grotesque 800 lowercase (ponto final em lime-text)
- Ícones: o protótipo usa formas geométricas simples; em produção manter **lucide-react** existente com `strokeWidth` 1.6–2
- Fontes via Google Fonts: Bricolage Grotesque, Instrument Sans, Spline Sans Mono

## Files
- `Viral Redesign.dc.html` — protótipo interativo (todas as telas; abrir no navegador)
- `Design System Viral.dc.html` — especificação visual dos tokens e componentes
- `tokens/globals.css` — **drop-in replacement** para `apps/web/src/app/globals.css` (todos os tokens dark + light, animações, scrollbars)
- `tokens/tailwind.config.ts` — **drop-in replacement** para `apps/web/tailwind.config.ts` (fontes, cores, raios, sombras)
- `tokens/fonts.ts` — snippet next/font para o `layout.tsx` (Bricolage Grotesque + Instrument Sans + Spline Sans Mono)
- `screenshots/` — captura de cada tela (01–14, dark + light)

> ⚠ **Nota sobre os screenshots:** a engine de captura não embute a fonte display — os títulos aparecem com fallback serifado. A fonte correta dos títulos é **Bricolage Grotesque** (sans, ver protótipo HTML ao vivo e `tokens/fonts.ts`). Use os screenshots para layout/cores, e o protótipo HTML como fonte da verdade tipográfica.

## Checklist de implementação sugerida
1. `globals.css`: trocar valores dos tokens (tabela acima) + variantes `.light` + aliases RGB
2. `layout.tsx`: next/font → Bricolage Grotesque (display), Instrument Sans (sans), Spline Sans Mono (mono); atualizar `tailwind.config.ts` (`fontFamily.display` novo)
3. `Button.tsx`: pill, primário lime com texto `#10120A`, novas variantes
4. `Sidebar.tsx`: novos labels, botão primário, card de quota, marker de item ativo
5. Telas na ordem: Dashboard → Novo corte (modal→página) → Processamento → Resultados → Editor → secundárias → Landing/Login
