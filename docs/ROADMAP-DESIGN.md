# ViralForge — Roadmap de Design & Front-End

**Data:** 2026-05-17 | **Versão:** 1.0

---

## Auditoria do Estado Atual

### O que já existe (e está OK)

| Aspecto | Avaliação | Detalhe |
|---|---|---|
| Design System base | ✅ Bom | CSS variables com paleta escura coerente, tokens de cor, border, shadow |
| Tipografia | ✅ Bom | Geist Sans — fonte moderna, boa legibilidade |
| Componentes primitivos | ✅ Funcional | Button (4 variantes), Input, Select — consistentes, acessíveis |
| Layout Dashboard | ✅ Funcional | Sidebar + main content, responsivo md breakpoint |
| Dark mode | ✅ Nativo | Toda a paleta é dark-first |
| Tailwind config | ✅ Organizado | Cores mapeadas via CSS vars, shadow customizado, easing |
| ClipGrid (mesa de revisão) | ✅ Bom | Layout list+preview, recorte manual, re-render, metadata |
| ProcessingTimeline | ✅ Funcional | Steps com ícones, progress, estado ativo |
| Accessibility basics | ✅ Presente | focus-visible, aria-label, htmlFor, reduced-motion |

### Problemas Críticos de Design

#### 1. **Ausência Total de Micro-Animações**
O app inteiro é estático. Nenhuma transição de entrada, nenhum fade, nenhum stagger. Quando o usuário navega entre páginas ou abre modais, tudo aparece instantaneamente como um JPEG. Opus Clip e Submagic têm transições suaves em cada interação.

**Onde faz falta:**
- Troca de clip selecionado (sem transição no painel de preview)
- Abertura do modal de novo projeto (sem fade/scale)
- Itens da lista de clips (sem stagger de entrada)
- Cards de projeto no dashboard (aparecem todos de uma vez)
- ProcessingTimeline (steps completados não têm animação de check)
- Toast notifications (Sonner já anima, mas é o único elemento)

#### 2. **Landing Page / Tela de Login Genérica**
A tela de login é um formulário solto no centro. Sem ilustração, sem proposta de valor, sem "wow". Um visitante que chega pela primeira vez não sente que é um produto premium.

**Comparação:**
- Opus Clip: landing page com vídeo de demo, testemunhos, animações de scroll
- Submagic: hero com preview interativo do editor
- ViralForge: formulário de login com "Entre na sua conta"

#### 3. **Project Cards Sem Thumbnail Real**
O `ProjectCard` mostra um ícone `<Film>` genérico em um retângulo cinza. Todos os projetos parecem iguais. Não existe preview visual do conteúdo.

**O que deveria ter:** thumbnail do primeiro clip ou frame do vídeo original.

#### 4. **Video Player Nativo do Browser**
O `<VideoPlayer>` é um `<video controls>` nativo. Funcional, mas feio. Os controles padrão do Chrome/Firefox não combinam com o design system escuro.

**O que os concorrentes fazem:** player custom com controles estilizados, barra de progresso com cor do tema, botões de velocidade, fullscreen com overlay.

#### 5. **Modal de Novo Projeto é um Formulário Denso**
O `NewProjectModal` tem 8 campos (título, URL, idioma, tipo, estilo, duração, layout, legenda) todos visíveis de uma vez. Parece painel de configuração, não criação de conteúdo.

**O que deveria ser:** wizard em steps ou pelo menos agrupamento visual com accordion/tabs.

#### 6. **Empty States Fracos**
O `EmptyState` provavelmente é texto + ícone. Sem ilustração, sem call-to-action forte, sem onboarding visual.

#### 7. **Sem Skeleton Loading Contextual**
Existe um `<Skeleton>` genérico, mas a experiência de loading é um retângulo cinza. Não comunica o que está carregando.

#### 8. **Settings Page Muito Técnica**
A página de settings é funcional e completa, mas visualmente densa. Cards com 5+ campos cada, todos visíveis. Parece painel de DevOps, não settings de criador.

#### 9. **Sem Feedback Visual na Lista de Clips**
Quando um clip está renderizando ou falhou, a informação existe mas é sutil. Não há indicador visual forte (cor de fundo, ícone animado, borda pulsante).

#### 10. **Responsividade Mobile Incompleta**
- Sidebar é `hidden md:flex` — no mobile some completamente
- Header mobile só tem 2 botões
- ClipGrid em mobile perde o layout de 2 colunas mas não adapta bem
- Sem menu hamburger / drawer

---

## Design System — O Que Falta

### Tokens Ausentes

```css
/* Animações — não existe nenhuma dessas */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Backdrop — não tem blur glass */
--glass-bg: rgba(17, 17, 17, 0.75);
--glass-border: rgba(255, 255, 255, 0.06);

/* Gradientes — body tem um sutil, mas nenhum reutilizável */
--gradient-accent: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
--gradient-glow: radial-gradient(circle, rgba(124, 58, 237, 0.15), transparent 70%);

/* Z-index scale — não existe */
--z-dropdown: 50;
--z-modal: 100;
--z-toast: 200;
```

### Componentes Ausentes

| Componente | Necessário para | Prioridade |
|---|---|---|
| `<Modal>` genérico | Substituir div fixa no NewProjectModal | Alta |
| `<Drawer>` mobile | Menu mobile, painel lateral | Alta |
| `<Tooltip>` | Informações contextuais nos ícones | Alta |
| `<Badge>` | Status, tags, categorias | Alta |
| `<Tabs>` | Settings, editor futuro | Média |
| `<Dropdown>` | Ações de clip, menu de perfil | Média |
| `<ProgressRing>` | Viral score visual, render progress | Média |
| `<Avatar>` | Perfil no sidebar | Baixa |
| `<Switch/Toggle>` | Configurações on/off | Baixa |
| `<Accordion>` | FAQ, settings colapsável | Baixa |
| `<CommandPalette>` | Power users, atalhos | P3 |

---

## Roadmap de Execução — Design

### Sprint D1 — Fundação de Animação & Componentes Core
**Duração:** 1-2 semanas
**Tese:** Adicionar vida ao app. Sem animação, qualquer design parece protótipo.

#### D1.1 — Biblioteca de Animação (Framer Motion)
- [x] Instalar `framer-motion` no web app
- [x] Criar utilitário `motion-variants.ts` com presets reutilizáveis:
  ```typescript
  export const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } }
  export const slideUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
  export const scaleIn = { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } }
  export const stagger = { animate: { transition: { staggerChildren: 0.05 } } }
  ```
- [x] Adicionar tokens de animação no `globals.css` (durations, easings)
- [x] Configurar `AnimatePresence` no layout root para transições de rota

#### D1.2 — Componente `<Modal>` Reutilizável
- [x] Criar `<Modal>` com:
  - Backdrop com blur (`backdrop-blur-sm`) e fade-in
  - Conteúdo com `scaleIn` animation
  - Fechar com `Escape` e click fora
  - Focus trap (acessibilidade)
  - Slot para header, body, footer
- [x] Migrar `NewProjectModal` para usar o `<Modal>` genérico
- [x] Transição de saída (fade-out + scale-down)

#### D1.3 — Componente `<Drawer>` Mobile
- [x] Criar `<Drawer>` para navegação mobile:
  - Slide-in da esquerda com overlay
  - Conteúdo = items do Sidebar atual
  - Botão hamburger no `<Header>` mobile
  - Swipe para fechar (touch)
- [x] Substituir sidebar hidden no mobile por Drawer

#### D1.4 — Componentes Utilitários
- [x] `<Tooltip>`: aparece no hover com delay 200ms, position auto (top/bottom)
- [x] `<Badge>`: variantes `default`, `success`, `warning`, `danger`, `accent`
- [x] `<Dropdown>`: menu flutuante com items, separadores, ícones
- [x] `<ProgressRing>`: SVG circular para viral score (substituir badge numérico)

#### D1.5 — Animações nas Páginas Existentes
- [x] Dashboard: cards de projeto com stagger fade-in ao carregar
- [x] ClipGrid: lista de clips com stagger, transição ao trocar clip selecionado
- [x] ProcessingTimeline: check animado ao completar step (scale bounce)
- [x] Settings: cards com fade-in sequencial
- [x] Login: formulário com slide-up ao montar

#### Gate D1
- [x] Abrir o dashboard e ver cards aparecendo com animação suave
- [x] Trocar clip selecionado e ver transição no painel de preview
- [x] Abrir/fechar modal com animação fluida
- [x] Navegar no mobile com drawer funcional

---

### Sprint D2 — Landing Page & Onboarding Premium
**Duração:** 1-2 semanas
**Tese:** A primeira impressão define se o usuário fica. Login genérico = bounce rate alto.

#### D2.1 — Landing Page Pública (`/`)
- [x] Hero section:
  - Headline: "Transforme vídeos longos em cortes virais em minutos"
  - Sub: "Cole um link do YouTube. A IA encontra os melhores momentos, corta em 9:16 e queima legendas profissionais."
  - CTA principal: "Comece grátis" (link para registro)
  - CTA secundário: "Veja como funciona" (scroll para demo)
  - Background: gradient mesh animado (CSS) com partículas sutis
- [x] Seção "Como funciona":
  - 3 steps visuais com ícones animados (Cole o link → IA analisa → Baixe clips prontos)
  - Cada step aparece com scroll-triggered animation
- [x] Seção "Antes / Depois":
  - Lado esquerdo: thumbnail de vídeo longo (1h+)
  - Lado direito: grid de 3-4 thumbnails de clips gerados
  - Animação: seta que se move do longo para os curtos
- [x] Footer mínimo: logo e descrição do produto
- [x] Responsividade mobile básica completa

#### D2.2 — Redesign da Tela de Login
- [x] Layout split-screen:
  - Lado esquerdo (60%): ilustração/gradiente com proposta de valor + features em bullet
  - Lado direito (40%): formulário de login com design premium
- [ ] Formulário:
  - Inputs com ícones inline (envelope para email, lock para senha)
  - Botão "Entrar" com gradient accent + hover glow
  - Link "Criar conta" abaixo
  - Logo no topo do formulário
- [x] Mobile: formulário centralizado, ilustração vira background gradient sutil

#### D2.3 — Redesign da Tela de Registro
- [x] Mesmo layout split-screen do login
- [x] Campos: nome, email, senha, confirmação
- [x] Indicador de força de senha (barra colorida)
- [ ] Link "Já tem conta? Entre aqui"

#### D2.4 — Onboarding Pós-Registro (Wizard)
- [ ] Step 1: "Bem-vindo ao ViralForge! 🔥" — breve explicação do que faz
- [ ] Step 2: "Configure sua IA" — form simplificado para DeepSeek + OpenAI keys com link para tutorial
- [ ] Step 3: "Crie seu primeiro projeto" — campo de URL do YouTube + botão
- [ ] Cada step com animação de transição (slide horizontal)
- [ ] Skip: "Configurar depois" em cada step
- [ ] Barra de progresso no topo (3 dots)

#### Gate D2
- [ ] Visitante novo vê landing page que impressiona
- [ ] Login tem visual premium, não genérico
- [ ] Novo usuário passa pelo onboarding e chega ao primeiro projeto sem confusão

---

### Sprint D3 — Polish Visual dos Componentes Core
**Duração:** 2 semanas
**Tese:** Cada pixel conta. Os detalhes separam "funcional" de "profissional".

#### D3.1 — Video Player Custom
- [x] Criar `<VideoPlayerCustom>` substituindo `<video controls>`:
  - Barra de progresso estilizada (cor accent, arredondada)
  - Botão play/pause centralizado com overlay (ícone grande, fade-in no hover)
  - Controles: play, volume, velocidade (0.5x, 1x, 1.5x, 2x), fullscreen
  - Timestamp atual / total
  - Esconder controles nativos do browser
  - Design integrado com o tema escuro
- [x] Manter `<video>` interno como base/fallback
- [ ] Barra de progresso mostra zona do clip (início→fim) vs zona de margem

#### D3.2 — Project Cards com Thumbnails
- [x] Quando projeto está COMPLETED: mostrar thumbnail do clip com maior viral score
- [x] Quando PROCESSING: mostrar progress ring animado sobre placeholder
- [x] Quando FAILED: mostrar overlay vermelho semitransparente com ícone de erro
- [x] Hover: card levanta levemente + border glow sutil
- [x] Informações de clips: "8 cortes · melhor score: 94"

#### D3.3 — Viral Score como Ring Visual
- [x] Substituir o `<ViralScoreBadge>` (número num círculo) por um `<ProgressRing>`:
  - SVG circular com arco preenchido proporcional ao score
  - Cores: <50 vermelho, 50-70 amarelo, 70-85 verde, 85+ roxo/accent
  - Número centralizado dentro do ring
  - Animação: arco cresce do zero ao valor ao aparecer na tela
- [x] Usar em: lista de clips e painel de preview

#### D3.4 — New Project como Wizard (Steps)
- [x] Quebrar o modal de 8 campos em 3 steps:
  - **Step 1 — Conteúdo:** Título + URL do YouTube (os mais importantes primeiro)
  - **Step 2 — Estilo:** Tipo de conteúdo + estilo + duração preferida + idioma
  - **Step 3 — Visual:** Layout de tela + tema de legenda (com mini-previews visuais)
- [x] Cada step com animação de slide horizontal
- [x] Barra de progresso (3 steps) no topo do modal
- [x] Botões "Voltar" e "Próximo" / "Criar e processar" no último
- [x] Mini-preview visual dos layouts
- [x] Mini-preview visual dos temas de legenda

#### D3.5 — Empty States com Ilustração
- [ ] Dashboard vazio: ilustração (ícone grande estilizado ou SVG) + "Nenhum projeto ainda" + CTA "Criar primeiro projeto"
- [ ] Clips vazio (durante processamento): animação de loading contextual
- [ ] Settings sem chave: ilustração de chave + "Configure para começar"

#### D3.6 — Skeleton Loading Contextual
- [x] Dashboard: skeleton que imita a forma dos ProjectCards (thumbnail + texto + badge)
- [ ] ClipGrid: skeleton que imita a lista de clips (círculo + linhas) + preview panel
- [ ] Settings: skeleton que imita os cards de provider
- [x] Animação: pulse com gradiente shimmer (não apenas cor sólida)

#### Gate D3
- [ ] Player de vídeo tem controles estilizados que combinam com o tema
- [ ] Project cards mostram thumbnail real do conteúdo
- [ ] Viral score é um ring visual animado
- [x] Criar projeto é um wizard guiado, não formulário denso
- [ ] Loading states são contextuais e elegantes

---

### Sprint D4 — Responsividade & Micro-Interações Avançadas
**Duração:** 1-2 semanas
**Tese:** Mobile-first não é opcional. E as micro-interações são o que faz o produto sentir "premium".

#### D4.1 — Responsividade Completa
- [ ] Mobile (< 768px):
  - Drawer navigation com swipe
  - ClipGrid: lista vertical com clip selecionado expandindo inline (accordion)
  - Video player: fullscreen nativo ao clicar
  - New project: wizard funciona em tela estreita
  - Settings: cards empilhados, campos full-width
- [ ] Tablet (768-1024px):
  - ClipGrid: layout side-by-side mas com painel de preview colapsável
  - 2 colunas no dashboard
- [ ] Testes: verificar todas as páginas em 375px, 768px, 1024px, 1440px

#### D4.2 — Micro-Interações de Feedback
- [ ] Botão "Re-renderizar": ícone gira enquanto processa
- [ ] Download: ícone de seta anima para baixo ao clicar
- [ ] Copiar link: ícone muda para check por 2s, depois volta
- [x] Clip selecionado na lista: border-left accent aparece com slide-in
- [ ] Drag nos handles de timeline: haptic feedback visual (pulse no handle)
- [ ] Score badge: pulso sutil a cada 3s quando score > 90 (atrair atenção)

#### D4.3 — Tema de Cores Alternativo (Light Mode)
- [ ] Criar variáveis CSS para light mode:
  ```css
  [data-theme="light"] {
    --bg-base: #FAFAFA;
    --bg-surface-1: #FFFFFF;
    --bg-surface-2: #F4F4F5;
    --text-primary: #18181B;
    --text-secondary: #52525B;
    /* ... */
  }
  ```
- [ ] Toggle no sidebar/header
- [ ] Respeitar `prefers-color-scheme` do sistema
- [ ] Não é prioridade, mas fundamental para adoção broader

#### D4.4 — Transições de Rota
- [x] Ao navegar entre dashboard → projeto: conteúdo antigo faz fade-out, novo faz fade-in
- [ ] Ao abrir projeto: header do projeto faz slide-down sutil
- [ ] Ao voltar: transição reversa (slide oposto)
- [x] Usar `AnimatePresence` + `motion.div` com `key={pathname}`

#### D4.5 — Acessibilidade Avançada
- [x] Todos os modais com focus trap
- [ ] Keyboard navigation completa: Tab entre seções, Enter para ações
- [x] aria-live regions para status de processamento (screen readers)
- [x] Skip-to-content link
- [ ] Contraste: verificar WCAG AA em todos os textos (text-muted pode falhar)

#### Gate D4
- [ ] App funciona perfeitamente em iPhone 13 (375px)
- [ ] Cada clique tem feedback visual imediato
- [ ] Light mode funcional
- [ ] Transições de rota suaves
- [ ] Score WCAG AA em contraste de texto

---

## Comparação Visual — Antes vs Depois

| Elemento | Antes (Atual) | Depois (Sprint D3) |
|---|---|---|
| Tela de login | Formulário solto, fundo escuro | Split-screen com ilustração + gradiente |
| Dashboard vazio | Texto "nenhum projeto" | Ilustração + CTA animado |
| Project Card | Ícone Film genérico | Thumbnail real + progress ring |
| Viral Score | Número em círculo flat | Ring SVG animado com arco colorido |
| Video Player | `<video controls>` nativo | Player custom com controles temáticos |
| Modal novo projeto | 8 campos de uma vez | Wizard em 3 steps com previews |
| Troca de clip | Instantânea, sem transição | Fade crossover no preview |
| Mobile | Sidebar some, layout quebra | Drawer + layout adaptativo |
| Loading | Retângulo cinza pulsante | Skeleton contextual com shimmer |

---

## Ferramentas & Dependências

| Pacote | Uso | Já instalado? |
|---|---|---|
| `framer-motion` | Animações, transições, gestos | ❌ Adicionar |
| `@radix-ui/react-dialog` | Modal acessível (base) | ❌ Adicionar |
| `@radix-ui/react-tooltip` | Tooltips acessíveis | ❌ Adicionar |
| `@radix-ui/react-dropdown-menu` | Dropdown menu | ❌ Adicionar |
| `tailwindcss` | Estilização | ✅ Já tem |
| `lucide-react` | Ícones | ✅ Já tem |
| `sonner` | Toast notifications | ✅ Já tem |
| `geist` | Tipografia | ✅ Já tem |

> **Nota:** Radix UI fornece primitivos acessíveis sem estilo — você aplica o visual do seu design system. Alternativa: construir do zero, mas demora 3x mais.

---

## Priorização vs Roadmap Técnico

| Sprint Design | Depende de Sprint Técnico? | Pode rodar em paralelo? |
|---|---|---|
| D1 (Animações + Componentes) | Não | ✅ Sim — puro front-end |
| D2 (Landing + Onboarding) | Não | ✅ Sim — puro front-end |
| D3 (Polish Visual) | Parcial — thumbnails precisam de API | ⚠️ Maioria sim |
| D4 (Responsive + Micro) | Não | ✅ Sim — puro front-end |

**Recomendação:** D1 e D2 podem começar imediatamente enquanto o Sprint 2 técnico (Remotion) está em andamento. D3 pode rodar em paralelo com Sprint 3 (face tracking). D4 é polish final.

---

## Métrica Final de Design

| Dimensão | Hoje | Após D1-D4 | Concorrentes |
|---|---|---|---|
| Animações & Transições | 1/10 | 8/10 | Opus 9, Submagic 9 |
| Landing / Primeira Impressão | 1/10 | 8/10 | Opus 9, Submagic 9 |
| Componentes UI | 5/10 | 8/10 | Opus 8, Submagic 9 |
| Responsividade Mobile | 3/10 | 8/10 | Opus 8, Submagic 8 |
| Player de Vídeo | 3/10 | 7/10 | Opus 8, Submagic 7 |
| Loading / Empty States | 3/10 | 8/10 | Opus 8, Submagic 8 |
| **UX/Design Score Total** | **2.7/10** | **7.8/10** | **Opus 8.5, Submagic 8.5** |
