# Plano de Migracao do Front-end ViralForge

Este documento compara os mockups `mockup-design-lovable` e `mockup-design-replit` contra o projeto real na raiz do workspace e propõe um plano de migração visual sem substituir a lógica de negócio existente.

## 1. Auditoria Independente

### 1.1 Mockup Lovable

Documento de especificação encontrado: `mockup-design-lovable/README.md`, mas ele contém apenas um placeholder. A referência real de design foi inferida do código, principalmente tokens, componentes `ds` e páginas.

| Dimensão | Nota | Justificativa | Evidência |
|---|---:|---|---|
| A. Fundação do Design System | 9 | Tem tokens HSL customizados, famílias tipográficas, escala de tipo e easings semânticos; perde 1 ponto por não aplicar numerais tabulares globalmente no `body`. | `mockup-design-lovable/tailwind.config.ts`, `mockup-design-lovable/src/index.css` |
| B. Componentes Primitivos | 8 | Existe uma camada `components/ds` própria para Button, Input, Card, Badge, Avatar e Skeleton, mas parte dos primitives Radix/shadcn ainda permanece com aparência default. | `mockup-design-lovable/src/components/ds/Button.tsx`, `mockup-design-lovable/src/components/ui/tabs.tsx` |
| C. Componentes de Assinatura | 8 | AppShell, CommandPalette, MomentStrengthBar, ScoreReadout e Editor são distintos, mas não há `ClipCard`/`TranscriptViewer` isolados como componentes reutilizáveis. | `mockup-design-lovable/src/components/global/CommandPalette.tsx`, `mockup-design-lovable/src/pages/Editor.tsx` |
| D. Completude de Páginas | 9 | Cobre landing, auth, onboarding, projetos, novo projeto, processamento, resultados, editor, analytics, billing, brand kit, scheduler, team, settings e styleguide. | `mockup-design-lovable/src/pages/` |
| E. Personalidade da Marca | 9 | A linguagem editorial/cinematográfica aparece nos tokens, tipografia serif italic, copy em português e densidade visual composta. | `mockup-design-lovable/src/pages/Landing.tsx`, `mockup-design-lovable/src/components/layout/AppShell.tsx` |
| F. Evitar Anti-Padrões | 7 | Evita emojis e copy genérica em geral, mas ainda usa gradientes decorativos, `picsum.photos`, `Sparkles` no logo e a palavra "viralização" na landing. | `mockup-design-lovable/src/pages/Landing.tsx`, `mockup-design-lovable/src/components/layout/AppShell.tsx` |
| G. Motion | 8 | Tem Framer Motion no shell e paleta, easings customizados e `prefers-reduced-motion`; falta uma biblioteca central explícita de arquétipos como entrance/reveal/defer/settle. | `mockup-design-lovable/src/components/layout/AppShell.tsx`, `mockup-design-lovable/src/index.css` |
| H. Realismo do Mock Data | 9 | Dados são ricos, em português, com IDs cruzados entre projetos, clips e transcrições, sem lorem ipsum. | `mockup-design-lovable/src/mocks/index.ts` |
| I. Reutilizabilidade para Migração | 7 | A camada `ds` é extraível, mas páginas estão acopladas a React Router, Zustand mockado e `@/mocks`. | `mockup-design-lovable/src/App.tsx`, `mockup-design-lovable/src/store/index.ts` |
| J. Acessibilidade e Responsividade | 7 | Há foco visível, labels em partes do Editor e botões com labels, mas alguns controles compostos e o shell mobile precisam auditoria ao portar. | `mockup-design-lovable/src/index.css`, `mockup-design-lovable/src/pages/Editor.tsx` |

**Nota total Lovable: 81/100**

**Top 3 pontos fortes**

| Força | Evidência |
|---|---|
| Fundação visual mais forte e customizada, com tokens próprios e escala tipográfica editorial. | `mockup-design-lovable/tailwind.config.ts`, `mockup-design-lovable/src/index.css` |
| Copy e mock data mais próximos do mercado brasileiro e do produto real. | `mockup-design-lovable/src/mocks/index.ts` |
| Shell e Command Palette têm personalidade premium e já estão em português. | `mockup-design-lovable/src/components/layout/AppShell.tsx`, `mockup-design-lovable/src/components/global/CommandPalette.tsx` |

**Top 3 pontos fracos**

| Fraqueza | Evidência |
|---|---|
| README não serve como contrato de design; é apenas placeholder. | `mockup-design-lovable/README.md` |
| Páginas usam mocks e React Router, então não podem substituir diretamente o Next App Router real. | `mockup-design-lovable/src/App.tsx`, `mockup-design-lovable/src/mocks/index.ts` |
| Alguns anti-padrões ainda aparecem: gradientes decorativos, `picsum.photos`, iconografia `Sparkles` e "viralização". | `mockup-design-lovable/src/pages/Landing.tsx`, `mockup-design-lovable/src/components/layout/AppShell.tsx` |

**Veredicto Lovable**

Lovable é o melhor ponto de partida para a direção visual. Ele entende melhor a personalidade editorial, composta e cinematográfica, e tem a melhor fundação de tokens. Não deve ser adotado 100% porque a estrutura é Vite/React Router, há acoplamento forte com mock data e alguns componentes de assinatura precisam ser extraídos ou reconstruídos.

### 1.2 Mockup Replit

Documentos de especificação encontrados: `mockup-design-replit/replit.md` e `mockup-design-replit/attached_assets/Pasted-You-are-going-to-do-a-comprehensive-quality-pass-on-the_1779050110865.txt`. O segundo é o contrato mais exigente: editorial, composto, cinematográfico, sem lorem, sem emojis, sem "viral", sem gradientes decorativos e com motion archetypes.

| Dimensão | Nota | Justificativa | Evidência |
|---|---:|---|---|
| A. Fundação do Design System | 7 | Usa HSL em CSS variables, Tailwind v4 via `@theme inline` e numerais tabulares globais, mas mantém nomes shadcn genéricos e não tem `tailwind.config.ts` com tokens `bg-base`, `signal-*`. | `mockup-design-replit/artifacts/clipforge/src/index.css` |
| B. Componentes Primitivos | 5 | Button, Card, Input e Badge são majoritariamente shadcn com pequenos ajustes `@replit`, ainda longe de primitives realmente autorais. | `mockup-design-replit/artifacts/clipforge/src/components/ui/button.tsx`, `mockup-design-replit/artifacts/clipforge/src/components/ui/card.tsx` |
| C. Componentes de Assinatura | 8 | Tem `ClipCard`, `VideoPlayer`, `MomentScore`, `ProcessingWaveform`, CommandPalette e Editor resizável em componentes/páginas mais isolados. | `mockup-design-replit/artifacts/clipforge/src/components/clip-card.tsx`, `mockup-design-replit/artifacts/clipforge/src/pages/editor.tsx` |
| D. Completude de Páginas | 9 | Implementa a mesma superfície ampla: landing, auth, onboarding, dashboard, new project, processing, results, editor, analytics, billing, brand kit, scheduler, team, settings e styleguide. | `mockup-design-replit/artifacts/clipforge/src/pages/` |
| E. Personalidade da Marca | 7 | Tem tom editorial e layout composto, mas a copy em inglês e alguns padrões de SaaS genérico reduzem a aderência ao produto brasileiro real. | `mockup-design-replit/artifacts/clipforge/src/mocks/index.ts`, `mockup-design-replit/artifacts/clipforge/src/pages/auth.tsx` |
| F. Evitar Anti-Padrões | 5 | Viola o próprio contrato com `Welcome back`, gradientes, `animate-pulse` em elementos idle e primitives shadcn aparentes. | `mockup-design-replit/artifacts/clipforge/src/pages/auth.tsx`, `mockup-design-replit/artifacts/clipforge/src/components/video-player.tsx` |
| G. Motion | 9 | Possui exatamente os arquétipos `entrance`, `reveal`, `defer`, `settle` em arquivo central e não depende de springs bouncy. | `mockup-design-replit/artifacts/clipforge/src/lib/motion.ts` |
| H. Realismo do Mock Data | 8 | Mock data é consistente, sem lorem e com IDs cruzados, mas é mais genérico e todo em inglês. | `mockup-design-replit/artifacts/clipforge/src/mocks/index.ts` |
| I. Reutilizabilidade para Migração | 8 | Componentes de assinatura são mais isolados e fáceis de extrair, mas ainda dependem de wouter, mocks e tokens shadcn. | `mockup-design-replit/artifacts/clipforge/src/components/clip-card.tsx`, `mockup-design-replit/artifacts/clipforge/src/App.tsx` |
| J. Acessibilidade e Responsividade | 7 | Aproveita primitives Radix/shadcn com foco e ARIA, e o Editor tem atalhos; controles customizados de player/timeline ainda exigem revisão. | `mockup-design-replit/artifacts/clipforge/src/pages/editor.tsx`, `mockup-design-replit/artifacts/clipforge/src/components/ui/button.tsx` |

**Nota total Replit: 73/100**

**Top 3 pontos fortes**

| Força | Evidência |
|---|---|
| Motion melhor estruturado, com variantes centrais nomeadas pelos arquétipos da spec. | `mockup-design-replit/artifacts/clipforge/src/lib/motion.ts` |
| Editor é mais ambicioso tecnicamente: painéis resizáveis, timeline, tabs, atalhos e fluxo de export. | `mockup-design-replit/artifacts/clipforge/src/pages/editor.tsx` |
| Componentes de assinatura como ClipCard, VideoPlayer e MomentScore estão mais isolados para extração. | `mockup-design-replit/artifacts/clipforge/src/components/clip-card.tsx`, `mockup-design-replit/artifacts/clipforge/src/components/moment-score.tsx` |

**Top 3 pontos fracos**

| Fraqueza | Evidência |
|---|---|
| Primitives ainda parecem shadcn default com pequenos remendos. | `mockup-design-replit/artifacts/clipforge/src/components/ui/card.tsx`, `mockup-design-replit/artifacts/clipforge/src/components/ui/input.tsx` |
| Contradiz anti-padrões do próprio contrato: `Welcome back`, gradientes e pulse idle. | `mockup-design-replit/artifacts/clipforge/src/pages/auth.tsx`, `mockup-design-replit/artifacts/clipforge/src/components/processing-waveform.tsx` |
| Menos aderente ao idioma, tom e mercado do ViralForge real. | `mockup-design-replit/artifacts/clipforge/src/mocks/index.ts` |

**Veredicto Replit**

Replit é menos forte como direção visual global, mas tem peças técnicas úteis: motion centralizada, Editor mais estruturado e alguns componentes de assinatura mais extraíveis. Não deve ser adotado 100%, porque sua fundação visual é mais shadcn/genérica e ele falha pontos explícitos da própria especificação de qualidade.

## 2. Análise Comparativa

| Dimensão | Lovable | Replit | Vencedor |
|---|---:|---:|---|
| A. Fundação do Design System | 9 | 7 | Lovable |
| B. Componentes Primitivos | 8 | 5 | Lovable |
| C. Componentes de Assinatura | 8 | 8 | Empate |
| D. Completude de Páginas | 9 | 9 | Empate |
| E. Personalidade da Marca | 9 | 7 | Lovable |
| F. Evitar Anti-Padrões | 7 | 5 | Lovable |
| G. Motion | 8 | 9 | Replit |
| H. Realismo do Mock Data | 9 | 8 | Lovable |
| I. Reutilizabilidade para Migração | 7 | 8 | Replit |
| J. Acessibilidade e Responsividade | 7 | 7 | Empate |

Os dois mockups cobrem praticamente a mesma superfície de produto: landing, auth, dashboard/projetos, novo projeto, processamento, resultados, editor, analytics, billing, brand kit, scheduler, team, settings e styleguide. Ambos são front-end only, usam mock data centralizado, rotas Vite e primitives derivados de shadcn/Radix. A qualidade geral de completude é similar, mas nenhum deles pode substituir diretamente o front real porque o projeto real usa Next App Router, TanStack Query, Zustand, API real e rotas já conectadas.

Eles divergem principalmente na direção visual e na organização de peças. Lovable é melhor em personalidade, idioma, tokens, primitives próprios e copy; Replit é melhor em modularidade de alguns componentes de assinatura e motion centralizada. Lovable tem uma Command Palette em português que Replit não iguala; Replit tem um Editor resizável com atalhos e uma lib de motion que Lovable não tem do mesmo jeito.

## 3. Inventário do Projeto Real

### DEVE PRESERVAR

| Item | Motivo | Caminho |
|---|---|---|
| Cliente HTTP centralizado, fallback de URL, headers auth, upload XHR, endpoints de settings/providers, quality e clips. | É a ponte funcional com a API real. | `apps/web/src/lib/api.ts` |
| Store de auth com Zustand/persist e helpers `getAuthToken`/`clearAuth`. | Mantém login, logout e autorização dos requests atuais. | `apps/web/src/stores/auth.store.ts` |
| Providers globais do Next/TanStack/Sonner. | Mantém cache, toasts e bootstrap client. | `apps/web/src/app/providers.tsx`, `apps/web/src/app/layout.tsx` |
| Tipos compartilhados de API: Project, Clip, AiProviderStatus, QualityOverview, RenderLayout, CaptionTheme. | Evita regressão silenciosa em contratos de dados. | `apps/web/src/types/api.types.ts` |
| Hooks de dados reais. | Já encapsulam polling, cache e dependências de query. | `apps/web/src/hooks/useProjects.ts`, `apps/web/src/hooks/useProject.ts`, `apps/web/src/hooks/useProjectPolling.ts`, `apps/web/src/hooks/useClips.ts`, `apps/web/src/hooks/useUpload.ts` |
| Fluxos de auth existentes. | Login/register precisam continuar chamando backend real. | `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/components/auth/RegisterForm.tsx` |
| Fluxo real de novo projeto com YouTube, upload fallback, duração preferida, layout e tema de legenda. | É funcionalidade de negócio atual, não mock. | `apps/web/src/components/project/NewProjectModal.tsx`, `apps/web/src/lib/project-options.ts` |
| Ações reais de clip: download, copiar legenda, feedback, timing/render. | Conectam com endpoints e telemetria reais. | `apps/web/src/components/clip/ClipActions.tsx`, `apps/web/src/components/clip/ClipFeedback.tsx`, `apps/web/src/components/clip/ClipTimeline.tsx` |
| Telemetria/analytics já instrumentada. | Não deve ser perdida na troca visual. | `apps/web/src/lib/analytics.ts` |
| Página real de integrações de IA com providers customizados, roles Pass 1/Pass 2 e testes. | Contém lógica que nenhum mockup implementa. | `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` |
| Quality dashboard real. | Mostra dados operacionais reais ausentes nos mockups. | `apps/web/src/app/(dashboard)/dashboard/quality/page.tsx` |
| Backend, worker, banco, clip-analyzer e render-engine. | A migração é visual; pipeline real deve permanecer intacto. | `apps/api/`, `apps/worker/`, `packages/database/`, `packages/clip-analyzer/`, `packages/render-engine/` |

### DEVE MIGRAR

| Funcionalidade real | Visual a substituir | Lógica real a conectar |
|---|---|---|
| `/login` e `/register` | Usar estrutura visual de auth Lovable com ajustes anti-pattern. | `api.auth.login`, `api.auth.register`, `useAuthStore.login`. |
| `/dashboard` lista de projetos | Usar grid/cards Lovable, com refinamento de cards de Replit quando útil. | `useProjects`, `ProjectGrid`, `ProjectCard`, `NewProjectModal`. |
| Modal "Novo projeto" | Usar linguagem visual Lovable de fluxo guiado e previews. | `api.projects.create`, `api.projects.submitYoutubeUrl`, opções de layout/legenda reais. |
| `/dashboard/[id]` PROCESSING | Usar composição cinematográfica Lovable, sem pulse idle excessivo. | `useProject`, `useProjectPolling`, `ProcessingTimeline`, `ProgressBar`. |
| `/dashboard/[id]` COMPLETED | Usar lista/preview densa inspirada nos mockups, preservando ações reais. | `useClips`, `api.clips.downloadUrl`, `api.clips.subtitleUrl`, feedback, render/timing. |
| Sidebar/Header | Usar AppShell Lovable adaptado para rotas reais. | `useAuthStore`, logout, links reais `/dashboard`, `/dashboard/settings`, `/dashboard/quality`. |
| Componentes UI básicos | Trocar primitives atuais por Lovable DS adaptado ao Next. | Props atuais de `Button`, `Input`, `Select`, `Modal`, `Tooltip`. |

### LACUNAS

| Lacuna | Situação |
|---|---|
| Integrações de IA avançadas | Projeto real tem provider customizado por role Pass 1/Pass 2; mockups só têm settings genéricos. Precisa UI nova no estilo Lovable. |
| Quality dashboard | Projeto real tem `/dashboard/quality`; mockups têm Analytics, mas não quality operacional com score buckets, feedback ruim e pipeline. |
| Recorte/re-render real por clip | Projeto real tem endpoints `updateTiming` e `render`, mas os mockups têm Editor mockado. Precisa uma UI conectada ao player real. |
| Upload fallback real | Replit/Lovable tratam upload como mock; projeto real tem upload XHR e YouTube principal. Precisa preservar fallback sem dar protagonismo. |
| Estados de erro reais | Mockups são otimistas; projeto real tem `FAILED`, `errorMessage`, clips em `FAILED` e retry. |
| Providers externos variados | OpenRouter/Grok/Kimi/Qwen/Gemini proxy existem no fluxo real de settings; nenhum mockup cobre essa complexidade. |

### NOMENCLATURA / ESTRUTURA A RECONCILIAR

| Diferença | Impacto |
|---|---|
| Real usa Next App Router em `apps/web/src/app`; mockups usam Vite com React Router/wouter. | Rotas e layouts precisam ser recriados no padrão Next, não copiados. |
| Real usa aliases `@/` dentro de `apps/web`; mockups usam seus próprios aliases e estrutura Vite. | Imports devem ser reescritos e componentes extraídos manualmente. |
| Real usa `dashboard` como rota base; Lovable usa `/app/projects`; Replit usa `/dashboard`, `/projects/new`, `/projects/:id/results`. | Navegação e active states precisam mapear para rotas reais. |
| Real tem componentes por domínio (`components/clip`, `project`, `processing`, `upload`); Lovable separa `components/ds`, `layout`, `global`; Replit mistura `components` e `components/ui`. | Migração deve preservar domínios reais e importar apenas padrões visuais. |
| Real trabalha com `ProjectStatus`, `ClipStatus`, `RenderLayout`, `CaptionTheme`; mockups têm tipos mockados diferentes. | Nada de portar tipos de mockup para o domínio real. |
| Real usa dados assíncronos via TanStack Query; mockups leem arrays locais. | Páginas migradas precisam manter loading/error/empty states reais. |

## 4. Recomendação

**Recomendação: OPÇÃO 3 — Híbrido.**

Raciocínio concreto: Lovable vence como design system, brand e shell; Replit vence em motion centralizada e algumas peças extraíveis de assinatura. Adotar qualquer um 100% destruiria lógica real e ainda importaria decisões ruins do mockup escolhido.

### Decisões de Origem Cruzada

```text
Pegar: mockup-design-lovable/tailwind.config.ts
Razão: Melhor fundação de tokens, escala tipográfica, semantic colors e easings.
```

```text
Pegar: mockup-design-lovable/src/index.css
Razão: Melhor base HSL, foco global, reduced motion e atmosfera editorial.
```

```text
Pegar: mockup-design-lovable/src/components/ds/Button.tsx
Razão: Primitive mais customizado e alinhado à marca que o Button shadcn do Replit.
```

```text
Pegar: mockup-design-lovable/src/components/ds/Card.tsx
Razão: Superfície simples, autoral e sem sombra/card shadcn default.
```

```text
Pegar: mockup-design-lovable/src/components/ds/Input.tsx
Razão: Estados de foco e superfície combinam com a direção visual escolhida.
```

```text
Pegar: mockup-design-lovable/src/components/ds/Badge.tsx
Razão: Tons semânticos e microtipografia melhores para status, score e categorias.
```

```text
Pegar: mockup-design-lovable/src/components/ds/IconButton.tsx, Avatar.tsx, Skeleton.tsx
Razão: Complementam primitives com linguagem visual consistente.
```

```text
Pegar: mockup-design-lovable/src/components/layout/AppShell.tsx
Razão: Melhor sidebar/topbar, melhor idioma, melhor densidade e melhor personalidade.
```

```text
Pegar: mockup-design-lovable/src/components/global/CommandPalette.tsx
Razão: Está em português, busca projetos/clips e tem composição mais premium.
```

```text
Pegar: mockup-design-lovable/src/pages/Projects.tsx
Razão: Melhor padrão visual para lista de projetos e cards editoriais.
```

```text
Pegar: mockup-design-lovable/src/pages/NewProject.tsx
Razão: Melhor fluxo guiado para criação, mas conectado ao modal real e não como página independente obrigatória.
```

```text
Pegar: mockup-design-lovable/src/pages/Processing.tsx
Razão: Melhor clima cinematográfico para processamento, desde que reduzido para dados reais e sem decoração excessiva.
```

```text
Pegar: mockup-design-lovable/src/pages/Results.tsx
Razão: Melhor direção visual para resultados e revisão, mas precisa receber componentes reais de clip.
```

```text
Pegar: mockup-design-lovable/src/pages/auth/AuthShared.tsx
Razão: Melhor fundação visual para login/register sem copy genérica.
```

```text
Pegar: mockup-design-replit/artifacts/clipforge/src/lib/motion.ts
Razão: Única implementação com os arquétipos entrance/reveal/defer/settle centralizados.
```

```text
Pegar: mockup-design-replit/artifacts/clipforge/src/components/clip-card.tsx
Razão: Melhor isolamento estrutural do card de clip; deve ser reestilizado com tokens Lovable e lógica real.
```

```text
Pegar: mockup-design-replit/artifacts/clipforge/src/components/moment-score.tsx
Razão: Score circular é uma peça visual reutilizável para substituir/elevar o ViralScoreBadge real.
```

```text
Pegar: mockup-design-replit/artifacts/clipforge/src/pages/editor.tsx
Razão: Melhor base para recorte/re-render com timeline, painéis resizáveis e atalhos, conectando aos endpoints reais de timing/render.
```

```text
Pegar: mockup-design-replit/artifacts/clipforge/src/components/ui/resizable.tsx
Razão: Necessário para o Editor avançado; manter Radix/react-resizable-panels se a dependência já existir ou for aprovada depois.
```

### 5 Principais Riscos da Migração

| Risco | Onde quebra | Mitigação |
|---|---|---|
| Regressão em fluxos reais ao trocar páginas mockadas por páginas visuais. | Login, novo projeto, processamento, resultados e settings. | Migrar página por página preservando hooks e `api.ts`; testar fluxo real após cada página. |
| Acoplamento de mock data entrar no código real. | `@/mocks`, tipos `Clip`/`Project` dos mockups. | Proibir imports de mockup; copiar só estrutura visual e mapear para `api.types.ts`. |
| Conflito entre tokens Lovable e classes reais atuais. | `globals.css`, `tailwind.config.ts`, classes `bg-bg-surface-*` atuais. | Criar camada de compatibilidade temporária para tokens antigos e novos. |
| Editor avançado parecer pronto mas não estar conectado ao vídeo real. | Recorte, preview, in/out handles e re-render. | Só expor Editor quando `api.clips.updateTiming/render` estiver conectado e testado. |
| Modal novo projeto continuar com problema de viewport/scroll. | `NewProjectModal` atual em telas menores. | Fase de layout deve padronizar modal centralizado com `max-h`, scroll interno e focus trap. |

## 5. Plano Consolidado de Migração

Este plano substitui as antigas seções de execução e elimina a contradição de ordem. A decisão final é: **Editor MVP entra antes de Settings para fechar o fluxo de revisão do clip; Editor Completo entra depois de Settings/Quality para não atrasar telas operacionais críticas com uma implementação pesada.**

### 5.1 Matriz Página a Página

| Tela / Fluxo | Lovable | Replit | Melhor base | Decisão |
|---|---:|---:|---|---|
| Landing pública | 8.5 | 7.0 | Lovable | Migrar explicitamente; é a porta de entrada e precisa refletir a nova qualidade visual. |
| Login / Register | 8.0 | 5.0 | Lovable | Usar visual Lovable preservando `LoginForm`, `RegisterForm`, auth store e redirects reais. |
| Onboarding | 8.0 | 7.0 | Lovable | Não migrar agora; não existe como fluxo real crítico no produto atual. |
| Dashboard / Projetos | 8.5 | 7.5 | Lovable | Usar Lovable para layout/lista; Replit só como referência de card isolado se útil. |
| Novo Projeto / Criação | 7.0 | 5.5 | Custom + Lovable | Nenhum mockup cobre a lógica real; redesenhar por cima do modal real. |
| Processing | 8.0 | 6.0 | Lovable | Usar Lovable como base conectada ao polling real, sem auto-redirect mockado. |
| Results / Clips | 8.0 | 7.5 | Híbrido | Lovable para composição; Replit para estrutura de card/score; lógica real preservada. |
| Editor / Recorte | 7.5 | 9.0 | Replit estrutural | Fazer em duas fases: MVP funcional primeiro, editor completo depois. |
| Settings / Integrações de IA | 6.5 | 6.0 | Custom + Lovable | UI nova; mockups são genéricos e inferiores à lógica real. |
| Quality / Analytics interno | 8.0 | 7.0 | Custom + Lovable | Inspirar em Lovable Analytics, mas com dados reais de qualidade. |
| Billing | 7.0 | 7.5 | Replit leve | Não migrar agora; não existe no front real atual. |
| Brand Kit | 7.5 | 7.0 | Lovable | Não migrar agora; futuro. |
| Scheduler | 7.5 | 6.5 | Lovable | Não migrar agora; futuro. |
| Team | 6.5 | 7.0 | Replit leve | Não migrar agora; futuro. |
| Styleguide | 8.0 | 8.0 | Híbrido | Usar como ferramenta interna de QA visual durante a migração. |

### 5.2 Critério Objetivo de Personalidade Visual

Cada fase visual só passa no checkpoint se a tela migrada for comparada contra pelo menos uma referência de qualidade, preferencialmente Linear, Vercel Dashboard ou Frame.io. A avaliação é binária por tela:

- **Editorial:** hierarquia tipográfica clara, copy direta, sem emojis, sem "Welcome back", sem buzzwords genéricas.
- **Composto:** grid/alinhamento consistentes, espaçamento previsível, cards com densidade controlada, nenhum elemento parecendo solto.
- **Cinematográfico:** superfícies escuras contidas, foco no vídeo/conteúdo, motion discreto, sem gradient mesh/aurora/glow gratuito.
- **Comparação visual:** screenshot 1366px lado a lado com referência escolhida; se a tela parecer mais genérica que a referência, reprova.
- **Anti-pattern check:** `rg "Welcome back|🔥|✨|🚀|gradient-mesh|aurora|animate-bounce|Most Popular"` não encontra ocorrências novas em UI migrada.

### 5.3 Camada de Compatibilidade Temporária de Tokens

**Implementação concreta**

- Implementar em `apps/web/src/app/globals.css` aliases CSS temporários entre tokens antigos e novos.
- Implementar em `apps/web/tailwind.config.ts` mapping de cores para os dois vocabulários durante a transição.
- Não usar `@apply` como estratégia principal de compatibilidade; `@apply` esconde dívida e dificulta remoção. O mapping deve ser por CSS variables e `theme.extend.colors`.
- Exemplo conceitual:

```css
:root {
  --bg-base: 240 23% 5%;
  --bg-surface: 240 21% 9%;
  --bg-elevated: 240 17% 12%;
  --text-primary: 0 0% 98%;
  --text-secondary: 240 6% 70%;
  --border-subtle: 240 12% 18%;

  /* aliases temporários para classes atuais */
  --bg-surface-1: var(--bg-surface);
  --bg-surface-2: var(--bg-elevated);
  --bg-surface-3: var(--bg-overlay);
  --text-muted: var(--text-tertiary);
  --danger: var(--signal-negative);
  --success: var(--signal-positive);
  --warning: var(--signal-caution);
}
```

**Fase de remoção**

- A camada é criada na Fase 1 e removida na Fase 15.

**Critério binário para remover**

- `rg "bg-bg-surface-|text-text-|border-border-|text-muted|bg-surface-1|bg-surface-2|bg-surface-3" apps/web/src` retorna zero usos fora de `globals.css`, `tailwind.config.ts` ou comentários de migração.
- Build passa.
- Todas as telas migradas foram verificadas em 375px e 1366px.
- Nenhum componente novo depende de token legado.

### 5.4 Risco Explícito: React Router / Wouter vs Next App Router

**Risco:** copiar páginas dos mockups diretamente quebra navegação, layouts, active states, params e renderização client/server, porque Lovable usa React Router e Replit usa wouter, enquanto o projeto real usa Next App Router.

**Símbolos a traduzir**

| Mockups | Next App Router |
|---|---|
| `Link` de `react-router-dom` ou `wouter` | `Link` de `next/link` |
| `useNavigate()` | `useRouter()` de `next/navigation` |
| `useLocation()` | `usePathname()` de `next/navigation` |
| `NavLink` | `Link` + helper `isActivePath(pathname, href)` |
| `Outlet` | `layout.tsx` + `children` |
| `Routes`, `Route`, `Switch` | Estrutura de pastas em `app/` |
| `useParams()` | `params` de page/layout ou `useParams()` de `next/navigation` em client components |

**Mitigação concreta**

- Port manual por tela; não fazer regex search-and-replace amplo.
- Criar no máximo um helper pequeno `isActivePath(pathname, href)` para active state.
- Proibir imports de `react-router-dom` e `wouter` em `apps/web`.
- Check obrigatório por fase que portar mockup: `rg "react-router-dom|wouter|useNavigate|useLocation|NavLink|Outlet|<Route|<Switch" apps/web/src` retorna zero.

### 5.5 Fases Numeradas

**Status de execução**

- `[ ]` pendente; `[x]` concluído.
- Validações manuais de screenshot, viewport, navegação por Tab e confirmação em PostHog foram marcadas como puladas por decisão explícita do usuário nesta execução.
- `[ ]` permanece apenas para itens não implementados nem pulados.

#### Fase 1 — Fundação de Design e Compatibilidade

**Entregável:** atualizar `apps/web/tailwind.config.ts`, `apps/web/src/app/globals.css`, fonte em `apps/web/src/app/layout.tsx` e criar camada temporária de aliases.

**Ordem:** vem primeiro porque qualquer tela migrada depende dos tokens, fontes, focus ring e compatibilidade com classes antigas.

**Origem visual:** Lovable tokens + `prefers-reduced-motion`; Replit para numerais tabulares globais.

**Complexidade:** M.

**Checklist binária**

- [ ] App compila sem erro de Tailwind.
- [ ] `body` usa numerais tabulares globalmente.
- [ ] `prefers-reduced-motion` reduz animações.
- [ ] Classes antigas foram substituídas por tokens novos e aliases temporários removidos do Tailwind.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de `/login` e `/dashboard` em 1366px não mostra regressão visual grave.
- [ ] Validação manual pulada por decisão do usuário: Screenshot comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim das telas abertas.

#### Fase 2 — Componentes Primitivos e Styleguide Interno

**Entregável:** redesenhar `Button`, `Input`, `Badge`, `Card`/surfaces, `Modal`, `Select`, `Tooltip`, `Skeleton`, `ProgressRing` preservando a API de props real; criar ou atualizar uma rota interna de styleguide.

**Ordem:** vem antes das páginas para evitar duplicar estilos em cada tela.

**Origem visual:** Lovable `components/ds/*`; Replit styleguide apenas para cobertura de estados.

**Complexidade:** M.

**Checklist binária**

- [ ] Todos os variants reais de `Button` renderizam.
- [ ] Inputs mantêm `label`, erro, disabled e focus state.
- [ ] Modal tem focus trap, escape, overlay e scroll interno.
- [ ] Skeletons não usam spinner genérico.
- [ ] Styleguide mostra todos os variants usados no produto.
- [ ] `rg "components/ds|@/mocks" apps/web/src` retorna zero.
- [ ] Validação manual pulada por decisão do usuário: Screenshot da styleguide comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim da styleguide.

#### Fase 3 — Shell, Navegação e Tradução de Router

**Entregável:** redesenhar `DashboardShell`, `Sidebar`, `Header`, `Logo`, `MobileNavDrawer` e active states no padrão Next.

**Ordem:** vem antes das telas protegidas porque define navegação, layout e contexto visual.

**Origem visual:** Lovable `AppShell.tsx`, sem copiar React Router.

**Complexidade:** M.

**Checklist binária**

- [ ] Sidebar abre e fecha no mobile.
- [ ] Header mostra usuário real ou fallback seguro.
- [ ] Logout limpa `useAuthStore` e redireciona.
- [ ] Active state funciona com `usePathname()`.
- [ ] Links reais funcionam: `/dashboard`, `/dashboard/settings`, `/dashboard/quality`.
- [ ] `rg "react-router-dom|wouter|useNavigate|useLocation|NavLink|Outlet|<Route|<Switch" apps/web/src` retorna zero.
- [ ] Validação manual pulada por decisão do usuário: Screenshot do shell comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim do shell.

#### Fase 4 — Landing Pública

**Entregável:** migrar `apps/web/src/app/page.tsx` com base Lovable, copy ViralForge, CTA para `/register` e `/login`, sem prometer billing/scheduler/social posting.

**Ordem:** entra cedo porque é independente da área logada e define a percepção pública do produto.

**Origem visual:** Lovable `Landing.tsx`, removendo "viralização", `picsum`, gradientes decorativos e claims não implementados.

**Complexidade:** M.

**Checklist binária**

- [ ] CTA "Criar conta" navega para `/register`.
- [ ] CTA "Entrar" navega para `/login`.
- [ ] Não há promessas de billing, team, scheduler, API pública ou publicação automática.
- [ ] `rg "viralização|picsum|Welcome back|🔥|✨|🚀" apps/web/src/app/page.tsx` retorna zero.
- [ ] Evento de analytics `landing_cta_clicked` foi implementado no CTA principal.
- [ ] Validação manual pulada por decisão do usuário: Screenshot da landing comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim da landing.

#### Fase 5 — Auth

**Entregável:** redesenhar `/login` e `/register` preservando `LoginForm`, `RegisterForm`, auth store e redirects.

**Ordem:** vem antes do dashboard porque é o gateway da área protegida.

**Origem visual:** Lovable `AuthShared.tsx`, com copy real do ViralForge.

**Complexidade:** P.

**Checklist binária**

- [ ] Validação manual pulada por decisão do usuário: Login com usuário válido entra em `/dashboard`.
- [ ] Validação manual pulada por decisão do usuário: Login inválido mostra erro inline.
- [ ] Validação manual pulada por decisão do usuário: Registro cria usuário ou mostra erro inline da API.
- [ ] Token continua salvo pelo fluxo real atual.
- [ ] Evento de analytics `auth_login_submitted` foi implementado no submit de login.
- [ ] Evento de analytics `auth_register_submitted` foi implementado no submit de registro.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de login/register comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim dos formulários.

#### Fase 6 — Dashboard de Projetos

**Entregável:** redesenhar `/dashboard`, `ProjectGrid`, `ProjectCard`, `EmptyState` e CTA de novo projeto.

**Ordem:** vem depois do auth porque é a primeira tela logada e alimenta todo o fluxo principal.

**Origem visual:** Lovable `Projects.tsx`; Replit `project-card.tsx` apenas como referência estrutural.

**Complexidade:** M.

**Checklist binária**

- [ ] `useProjects` carrega projetos reais.
- [ ] Loading state aparece antes dos dados.
- [ ] Empty state aparece quando não há projetos.
- [ ] Card navega para `/dashboard/[id]`.
- [ ] Status real do projeto é exibido.
- [ ] Botão "Novo projeto" abre o modal.
- [ ] Evento de analytics `dashboard_new_project_clicked` foi implementado ao abrir o modal pelo dashboard.
- [ ] Validação manual pulada por decisão do usuário: Screenshot do dashboard comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim do dashboard.

#### Fase 7 — Novo Projeto Modal

**Entregável:** redesenhar `NewProjectModal` centralizado, com três etapas, previews de layout/legenda, YouTube principal, upload fallback, scroll interno, focus trap, responsividade e analytics.

**Ordem:** vem antes de Processing porque é o ponto de criação dos jobs.

**Origem visual:** custom com linguagem Lovable; preservar a lógica real atual.

**Complexidade:** GG.

**Critério da complexidade:** é GG porque combina UI complexa, fluxo assíncrono real, acessibilidade de modal, duas fontes de entrada, opções de renderização, eventos de analytics e responsividade crítica. Não é apenas visual.

**Checklist binária**

- [ ] Modal abre centralizado em 1366px.
- [ ] Validação manual pulada por decisão do usuário: Modal abre usável em 375px.
- [ ] Conteúdo interno rola sem mover a página atrás.
- [ ] Focus trap funciona dentro do modal.
- [ ] Escape fecha o modal sem quebrar estado.
- [ ] Etapa Fonte valida título e URL.
- [ ] Etapa Estratégia salva idioma, tipo, estilo e duração preferida.
- [ ] Etapa Visual salva `captionTheme` e `renderLayout`.
- [ ] YouTube chama `api.projects.create` e depois `api.projects.submitYoutubeUrl`.
- [ ] Upload fallback chama `api.projects.upload` com progresso real.
- [ ] Erro da API aparece no modal sem fechar a UI.
- [ ] Evento de analytics `project_created` foi implementado após criar projeto.
- [ ] Evento de analytics `project_upload_started` foi implementado ao iniciar upload fallback.
- [ ] Validação manual pulada por decisão do usuário: Screenshot do modal comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim do modal.

#### Fase 8 — Processing

**Entregável:** redesenhar `/dashboard/[id]` em estado PROCESSING/FAILED mantendo polling e retry.

**Ordem:** vem depois de Novo Projeto porque é a próxima etapa natural do job.

**Origem visual:** Lovable `Processing.tsx`, sem auto-redirect mockado e sem pulse idle exagerado.

**Complexidade:** M.

**Checklist binária**

- [ ] `useProjectPolling` atualiza progresso a cada 3s.
- [ ] Timeline reflete a porcentagem real.
- [ ] Ao completar, queries de projeto e clips são invalidadas.
- [ ] Estado FAILED mostra `errorMessage` real.
- [ ] Retry chama `api.projects.retry`.
- [ ] Evento de analytics `project_processing_viewed` foi implementado ao abrir tela de processamento.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de processing comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim da tela.

#### Fase 9 — Results Mestre-Detalhe

**Entregável:** redesenhar view COMPLETED com lista compacta de clips, preview selecionado, metadados visíveis e ações reais.

**Ordem:** vem depois de Processing porque é onde o usuário avalia o resultado do job.

**Origem visual:** Lovable para composição; Replit para card/score isolado.

**Complexidade:** G.

**Checklist binária**

- [ ] `useClips` carrega clips reais.
- [ ] Lista ordena por score.
- [ ] Seleção de clip troca preview sem reload.
- [ ] Player toca o MP4 real.
- [ ] Download chama fluxo real de `ClipActions`.
- [ ] Copiar legenda copia VTT/texto real.
- [ ] Feedback "Não curti" salva via API.
- [ ] `openingStrength`, `closingStrength`, `riskOfBadCut` e `needsReview` aparecem quando disponíveis.
- [ ] Evento de analytics `clip_played` foi implementado ao tocar preview.
- [ ] Evento de analytics `clip_downloaded` foi implementado ao baixar clip.
- [ ] Evento de analytics `clip_marked_bad` foi implementado ao enviar feedback ruim.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de results comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim da tela.

#### Fase 10 — Editor MVP

**Entregável:** criar ajuste simples de in/out + preview + re-render sem IA. Sem painéis resizáveis, sem waveform completa, sem atalhos avançados.

**Ordem:** entra agora para resolver a dor principal de início/fim sem atrasar Settings/Quality com um editor pesado.

**Origem visual:** Replit como referência de recorte; UI simplificada com tokens Lovable.

**Complexidade:** G.

**Escopo exato**

- Player real do clip.
- Campos/controles para start e end.
- Botões `-0.5s`, `+0.5s`, "marcar início", "marcar fim".
- Margem visual de 10s quando houver `suggestedStart`/`suggestedEnd`.
- Botão "Salvar e re-renderizar".
- Estado de renderização e erro.

**Fora do MVP**

- Timeline waveform completa.
- Painéis resizáveis.
- Atalhos J/K/L/I/O.
- Caption blocks avançados.
- Layout segmentado por trecho.

**Checklist binária**

- [ ] Abrir Editor MVP a partir de um clip em Results.
- [ ] Player carrega vídeo real autenticado.
- [ ] Start não pode ficar menor que 0.
- [ ] End não pode ficar menor ou igual a start.
- [ ] Ajustes de 0.5s atualizam preview.
- [ ] `api.clips.updateTiming` é chamado ao salvar timing.
- [ ] `api.clips.render` é chamado ao re-renderizar.
- [ ] Estado de loading aparece durante render.
- [ ] Erro de render aparece sem perder ajustes.
- [ ] Ao finalizar, clip atualizado aparece em Results.
- [ ] Evento de analytics `clip_timing_adjusted` foi implementado ao salvar ajuste.
- [ ] Evento de analytics `clip_rerender_requested` foi implementado ao solicitar render.
- [ ] Validação manual pulada por decisão do usuário: Screenshot do Editor MVP comparado com Frame.io/Vercel passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim do Editor MVP.

#### Fase 11 — Settings / Integrações de IA

**Entregável:** redesenhar `/dashboard/settings` com pipeline ativo, providers configurados, provider customizado, teste, ativação, remoção e estado mascarado.

**Ordem:** vem depois do Editor MVP porque não bloqueia o primeiro ciclo de revisão, mas precisa vir antes do Editor Completo por ser operação crítica.

**Origem visual:** custom com linguagem Lovable.

**Complexidade:** G.

**Checklist binária**

- [ ] `api.settings.providers` carrega providers reais.
- [ ] Pipeline ativo mostra Pass 1, Pass 2 e Transcrição.
- [ ] Adicionar provider customizado funciona.
- [ ] Ativar provider para PASS1 funciona.
- [ ] Ativar provider para PASS2 funciona.
- [ ] Testar provider mostra latência/status.
- [ ] Remover provider funciona.
- [ ] Chave nunca aparece inteira na UI.
- [ ] Erro de teste/API aparece no card correto.
- [ ] Evento de analytics `ai_provider_saved` foi implementado ao salvar provider.
- [ ] Evento de analytics `ai_provider_tested` foi implementado ao testar provider.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de settings comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim da tela.

#### Fase 12 — Quality Dashboard

**Entregável:** redesenhar `/dashboard/quality` com KPIs, distribuição de score, motivos de rejeição e projetos recentes.

**Ordem:** vem antes do Editor Completo para medir se as melhorias estão afetando qualidade real.

**Origem visual:** Lovable Analytics como inspiração visual; dados do projeto real.

**Complexidade:** M.

**Checklist binária**

- [ ] `api.quality.overview` carrega dados reais.
- [ ] KPIs principais aparecem.
- [ ] Buckets de score batem com payload.
- [ ] Motivos de rejeição batem com payload.
- [ ] Projetos recentes linkam para `/dashboard/[id]`.
- [ ] Empty state aparece quando não há dados.
- [ ] Evento de analytics `quality_dashboard_viewed` foi implementado ao abrir a página.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de quality comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim da tela.

#### Fase 13 — Motion, Empty States e Command Palette

**Entregável:** centralizar motion variants, padronizar empty states e adicionar Command Palette real se não prejudicar foco.

**Ordem:** vem depois das telas principais para polir padrões reais, não abstrações imaginadas.

**Origem visual:** Replit `lib/motion.ts`; Lovable `CommandPalette.tsx`; Lovable empty states.

**Complexidade:** M.

**Checklist binária**

- [ ] `entrance`, `reveal`, `defer`, `settle` existem em `motion-variants`.
- [ ] Não há springs bouncy ou elastic easings.
- [ ] `prefers-reduced-motion` desliga transições relevantes.
- [ ] Empty states têm ilustração, headline, texto e um CTA primário.
- [ ] Command Palette abre com `Cmd/Ctrl+K`.
- [ ] Command Palette navega para rotas reais.
- [ ] Command Palette não importa mocks.
- [ ] Evento de analytics `command_palette_opened` foi implementado ao abrir a paleta.
- [ ] Validação manual pulada por decisão do usuário: Screenshot de empty states e command palette comparado com Linear/Vercel/Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim dos estados/paleta.

#### Fase 14 — Editor Completo

**Entregável:** evoluir Editor MVP para timeline waveform, painéis resizáveis, atalhos, caption blocks e preview avançado.

**Ordem:** vem depois de Settings/Quality porque só vale investir no editor pesado quando já existe fluxo medido e operacional.

**Origem visual:** Replit `pages/editor.tsx` para estrutura; Lovable tokens e primitives para acabamento.

**Complexidade:** GG.

**Critério para promover MVP para Completo**

- Pelo menos 5 sessões reais ou testes internos com vídeos reais foram feitos.
- Pelo menos 30% dos clips revisados usaram ajuste de timing no Editor MVP, ou pelo menos 3 usuários/testadores pediram edição mais precisa.
- Quality Dashboard mostra feedback relevante de `WEAK_START` ou `WEAK_END`.
- O tempo médio de ajuste no Editor MVP não é suficiente para o usuário confiar no corte final.

**Checklist binária**

- [ ] Timeline waveform é renderizada de forma determinística.
- [ ] In/out handles são arrastáveis.
- [ ] Playhead é arrastável.
- [ ] Caption blocks aparecem alinhados ao tempo quando houver legenda.
- [ ] Painéis resizáveis não quebram layout.
- [ ] Atalhos Space, J/K/L, I/O, Cmd/Ctrl+S funcionam.
- [ ] Preview respeita start/end atuais.
- [ ] Re-render usa os mesmos endpoints reais do MVP.
- [ ] Evento de analytics `editor_full_opened` foi implementado ao abrir Editor Completo.
- [ ] Evento de analytics `editor_shortcut_used` foi implementado ao usar atalho.
- [ ] Validação manual pulada por decisão do usuário: Screenshot do Editor Completo comparado com Frame.io passa nos critérios editorial, composto e cinematográfico.
- [ ] Validação manual pulada por decisão do usuário: Testado em viewport 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Testado com tecla Tab navegando do início ao fim do Editor Completo.

#### Fase 15 — QA Final e Remoção de Compatibilidade

**Entregável:** regressão visual/funcional completa, remoção da camada temporária de tokens e validação de build.

**Ordem:** vem por último porque só faz sentido remover aliases quando todas as telas migradas não usam mais classes antigas.

**Origem visual:** N/A; fase de validação.

**Complexidade:** M.

**Checklist binária**

- [ ] Build passa.
- [ ] Lint/typecheck disponível passa ou pendências são documentadas.
- [ ] Validação manual pulada por decisão do usuário: Login funciona.
- [ ] Validação manual pulada por decisão do usuário: Registro funciona.
- [ ] Validação manual pulada por decisão do usuário: Criar projeto por YouTube funciona.
- [ ] Validação manual pulada por decisão do usuário: Upload fallback funciona.
- [ ] Validação manual pulada por decisão do usuário: Processing chega em completed/failed corretamente.
- [ ] Validação manual pulada por decisão do usuário: Results toca clip real.
- [ ] Validação manual pulada por decisão do usuário: Download funciona.
- [ ] Validação manual pulada por decisão do usuário: Copiar legenda funciona.
- [ ] Validação manual pulada por decisão do usuário: Feedback ruim funciona.
- [ ] Validação manual pulada por decisão do usuário: Editor MVP re-renderiza sem IA.
- [ ] Validação manual pulada por decisão do usuário: Settings salva/testa/remove provider.
- [ ] Quality carrega dados reais.
- [ ] `rg "bg-bg-surface-|text-text-|border-border-|text-muted|bg-surface-1|bg-surface-2|bg-surface-3" apps/web/src apps/web/tailwind.config.ts` retorna zero usos.
- [ ] `rg "react-router-dom|wouter|useNavigate|useLocation|NavLink|Outlet|<Route|<Switch" apps/web/src` retorna zero.
- [ ] Validação manual pulada por decisão do usuário: Todos os eventos de analytics listados nas fases anteriores foram verificados pelo menos uma vez.
- [ ] Validação manual pulada por decisão do usuário: Todas as telas principais foram testadas em 375px e 1366px.
- [ ] Validação manual pulada por decisão do usuário: Todas as telas principais foram testadas com Tab do início ao fim.
- [ ] Validação manual pulada por decisão do usuário: Screenshots finais das telas principais passam nos critérios editorial, composto e cinematográfico.

## 6. Resolução Final de Ordem

| Ordem | Fase | Justificativa curta |
|---:|---|---|
| 1 | Fundação de Design e Compatibilidade | Bloqueia todo o visual e evita quebrar classes antigas. |
| 2 | Componentes Primitivos e Styleguide | Evita repetir estilos por página e valida estados base. |
| 3 | Shell, Navegação e Router | Define o container real da área logada e resolve React Router vs Next cedo. |
| 4 | Landing Pública | É independente e melhora percepção externa sem depender de dados logados. |
| 5 | Auth | Libera entrada segura na área protegida. |
| 6 | Dashboard de Projetos | Primeira tela logada e ponto de partida do fluxo. |
| 7 | Novo Projeto Modal | Cria jobs reais; complexidade GG por fluxo assíncrono + modal acessível + previews. |
| 8 | Processing | Próxima etapa natural depois de criar projeto. |
| 9 | Results Mestre-Detalhe | Onde o usuário avalia e baixa clips. |
| 10 | Editor MVP | Fecha a dor de início/fim sem bloquear a migração com editor pesado. |
| 11 | Settings / Integrações de IA | Operação crítica, mas não bloqueia o primeiro ciclo de revisão. |
| 12 | Quality Dashboard | Mede qualidade real antes de investir no Editor Completo. |
| 13 | Motion, Empty States e Command Palette | Polimento aplicado sobre telas reais, não mocks. |
| 14 | Editor Completo | Só entra se o MVP provar demanda por edição mais precisa. |
| 15 | QA Final e Remoção de Compatibilidade | Remove dívida temporária e valida o produto inteiro. |

## 7. Decisão Final Revisada

**Não existe vencedor único.**

A decisão correta é:

- **Lovable como pele e linguagem principal.**
- **Replit como referência técnica para Editor, motion e alguns componentes isolados.**
- **Projeto real como fonte de verdade funcional.**
- **UI nova onde ambos os mockups são fracos: Novo Projeto, Settings de IA, Quality e fluxo de recorte real.**

Copiar um mockup inteiro seria mais rápido, mas tecnicamente errado. O caminho certo é redesenhar por cima da aplicação real, usando o melhor de cada mockup e criando telas novas onde a lógica real é mais avançada que os designs.
