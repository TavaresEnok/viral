# Auditoria ViralForge — MVP para Produção (Gemini 3.1 Pro)

## 1. Sumário Executivo
*   **Estado Atual:** O ViralForge encontra-se na fase de MVP Avançado. O backend com NestJS + BullMQ é robusto, o pipeline de 2 passagens de IA é acima da média de mercado, e o front-end Next.js já suporta as interações principais de criação de projeto e edição.
*   **Segurança (P0/P1):** Ausência total de Rate Limiting escalável (apenas in-memory map), path traversal no download de clips, JWT no localStorage sem httpOnly e refresh token inexistente.
*   **Infraestrutura & Escalabilidade (P1):** Processos síncronos de arquivos ainda presentes, download centralizado na API Node.js (sem CDN), renderização bloqueando event loop ou usando alto processamento em concorrência mal calibrada.
*   **Funcionalidade Core (P1):** Face tracking é inexistente (apenas um mock ou serviço pendente). Layouts de tela dependem disso. Falta integração total com redes sociais.
*   **Oportunidade (P2):** Tem grande potencial competitivo pela arquitetura limpa (monorepo, Next.js, Prisma) e IA customizada multi-pass, além do uso inovador do Remotion em detrimento do FFmpeg nativo para efeitos.
*   **Decisão Estratégica 1:** O rate limiter e brute force store devem migrar obrigatoriamente para Redis hoje.
*   **Decisão Estratégica 2:** Transferir os downloads pesados para CDN/S3 para aliviar o Node.js.
*   **Decisão Estratégica 3:** Focar na implementação de face tracking com MediaPipe para viabilizar reframing autônomo, essencial no mercado atual.

## 2. Mapa do Sistema Atual
*   **Arquitetura:** Monorepo gerenciado por `pnpm`, usando Node.js.
*   **Front-end (`apps/web`):** Next.js 14 (App Router), React 18, TailwindCSS, Zustand (Estado Local), TanStack Query (Server State e Cache).
*   **Back-end (`apps/api`):** API Gateway em NestJS e Prisma ORM conectado a um Postgres. Autenticação via JWT, emite Jobs no BullMQ.
*   **Worker (`apps/worker`):** Serviço autônomo (Nest Application Context) que escuta filas BullMQ. Executa transcrição (YouTube Captions/ASR externo), FFmpeg para download/conversão e Remotion para renderização.
*   **Pacotes Independentes:** `clip-analyzer` (Módulo LLM que pontua as falas) e `render-engine` (React/Remotion para templates e legendas word-by-word).

## 3. Matriz de Risco

| ID | Severidade | Tipo | Área | Problema | Evidência | Impacto | Correção | Critério de aceite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | P0 | Security | API/Auth | Rate limiter apenas em memória. | `Map<string, RateLimitEntry>` em `throttler.guard.ts`. | Brute-force ou DoS derrubam servidor e perdem estado ao reiniciar. | Migrar para Redis com TTL expirando. | Limites bloqueiam após N falhas e sobrevivem a restart da API. |
| **SEC-02** | P0 | Security | Auth | Ausência de Refresh Token. | Só emite Access Token de longa duração. | Roubo de token compromete acesso permanentemente; rotação impossível. | Criar tabela `RefreshToken`, JWT curto (15m), endpoint `/refresh`. | Após 15min, token access expira e app renova invisivelmente. |
| **SEC-03** | P1 | Security | API/Storage | Path Traversal potencial em download. | Falta de `path.resolve` e validação restrita no path requisitado. | Acesso arbitrário a arquivos fora de `/tmp` ou storage. | Validar path e servir URLs temporárias do S3/CDN em vez de FS local. | Requisições a `../../etc/passwd` devem retornar 400 ou 403. |
| **UX-01** | P1 | UX | Web | Filtro de clips mockado. | `ClipGrid.tsx` possui botão sem handler funcional. | Usuário fica preso buscando clips em projetos grandes. | Implementar filtro no Zustand e aplicar na lista. | Botão de filtro altera a UI refletindo a categoria escolhida. |
| **PROD-01**| P1 | Product | Worker | Face Tracking inexistente. | `FaceDetectionService` sem modelo de ML ativo (mock). | O layout `SMART_REFRAME` não foca no rosto e gera clip inútil. | Implementar MediaPipe Face Detection no FFmpeg stream. | Rosto descentralizado no vídeo original fica no centro do clip 9:16. |

## 4. Auditoria por Área

### 4.1 Produto/UX
*   **Onboarding:** Totalmente ausente. Novos usuários encaram um dashboard vazio sem ajuda (Empty States fracos).
*   **Mobile:** O Editor não tem layout adaptativo. Botões apertados e timeline inviável em 375px.
*   **Painéis "Mockados":** Telas de Analytics, Billing e Brand Kit não estão persistindo os dados nem realizando integrações reais.

### 4.2 Segurança
*   **Rate Limiter:** Estado efêmero (em memória).
*   **JWT e Cookie:** JWT salvo de modo desprotegido. Migrar para Cookies `httpOnly` para evitar XSS (Cross Site Scripting).
*   **API Keys:** Secrets de LLM parecem encriptados, mas precisam de rotação de chave `MASTER_SECRET`.

### 4.3 API/Backend
*   **Consistência de Status:** Ausência de transações robustas nos updates do Prisma. Se o worker cair durante o upload, um projeto pode ficar "preso" para sempre como "PROCESSING".
*   **Limpeza Órfã:** `CronJob` necessário para arquivos em `/tmp` (de vídeos brutos falhados) que enchem o disco.

### 4.4 Worker/Fila
*   **BullMQ:** Retry policies estão básicas. Falta um mecanismo de "Dead Letter Queue" para que trabalhos travados ou sistematicamente falhos possam ser investigados sem reprocessamento infinito.
*   **Observabilidade:** Worker engole erros graves no LLM. Recomenda-se adicionar traces com Sentry.

### 4.5 ASR/Transcrição
*   Atualmente refém de legendas prontas (YouTube) ou ASR externo que é demorado/custoso. Integrar ASR rápido e local, como o modelo leve do `Faster-Whisper` com fallback, pouparia custos em vídeos curtos e aumentaria precisão.

### 4.6 IA/Qualidade dos Cortes
*   O pipeline "Pass 1 + Pass 2" no `clip-analyzer` é o grande trunfo, com pontuações virais altamente precisas, focadas em contexto, emoção e "quotability" (frases marcantes).
*   Falta um sistema que avalie se o corte possui B-Roll adequado.

### 4.7 Render/Vídeo
*   Remotion integrado ao Node resolve sincronia e traz visual lindo de fontes web, porém consome extrema CPU. Sem cache de frames ou offloading via Redis/CDN. Otimização urgente requerida para processamento multithreading sem engasgos.

### 4.8 Front-end/Design System
*   UI bonita baseada em Tailwind, forte estética e uso apropriado de Server State (TanStack Query). Falta implementar Virtualization (ex: `react-virtual`) em grades longas.

### 4.9 Banco/Dados
*   O schema do Prisma precisará de novas entidades de Quota e Faturamento (Stripe) que atualmente estão incompletas.

### 4.10 DevOps/Produção
*   Inexistência de pipelines CI/CD automatizados ou testes integrados robustos. `Docker-compose.yml` serve apenas de rascunho de dev, falhando na escalabilidade.

### 4.11 Testes
*   Falta grave: sem bateria E2E (Playwright). É necessário validar o upload -> criação de clips -> download completo.

### 4.12 Billing/Quotas
*   A quota é baseada num Worker local, mas não é auditável. Módulo de Webhook do Stripe ou similar não finalizado.

## 5. Comparativo Competitivo

| Feature | ViralForge Atual | OpusClip | Vizard.ai | Submagic | Gap | Prioridade |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Qualidade da IA** | Excelente (9.0) | 9.0 | 8.5 | 8.0 | Sem gap real. | Baixa |
| **Legendas Animadas** | Remotion Básico | Avançado | Médio | Premium | **Falta Kinetic Typography** | **Alta** |
| **Face Tracking** | Mock (1.0) | 9.5 | 8.5 | 8.0 | **Não acompanha palestrante** | **Alta** |
| **B-Roll Auto** | Ausente (0.0) | 9.0 | 7.0 | 8.5 | **Vídeos ficam monótonos** | **Média** |
| **Infra/Cloud** | Local/Docker | 9.5 | 9.0 | 8.5 | **Lentidão em picos** | **Alta** |

## 6. Roadmap de Produção por Fases

### 🔴 Sprint 1: Fundação & Sobrevivência (2 Semanas)
*   **Objetivo:** Consertar falhas de segurança e vazamentos.
*   **Entregáveis:** Rate limiter no Redis; Refresh Tokens; Corrige Path Traversal. Migrar de `fs` síncrono para `fs.promises`.
*   **Critério de Aceite:** Servidor não derruba sob brute-force (100req/s na API). Arquivos temporários deletam via CRON.

### 🟡 Sprint 2: Motor Inteligente (3 Semanas)
*   **Objetivo:** Funcionalidade Face Tracking e Qualidade.
*   **Entregáveis:** Integração de Face Tracking via MediaPipe no `worker`. Auto-reframe ativado no FFmpeg para gerar cortes que seguem o rosto.
*   **Critério de Aceite:** Um vídeo com 3 palestrantes deve ter todos centralizados nos cortes criados (9:16).

### 🟢 Sprint 3: Apresentação e Fluxo Completo (3 Semanas)
*   **Objetivo:** Workflow sem atrito, UX de onboarding.
*   **Entregáveis:** Filtro de clips. Onboarding Wizard no frontend para configurar projetos/API keys. Integração de WebSockets pra envio do progresso (Remover Polling). CDN R2 via Cloudflare p/ downloads de clips.
*   **Critério de Aceite:** Downloads 50x mais rápidos servidos por R2 em vez do node-express.

### 🏆 Sprint 4: Nível Opus (4 Semanas)
*   **Objetivo:** Funcionalidades matadoras e escalabilidade total.
*   **Entregáveis:** Integração de Webhook de Billing (Stripe Checkout completo). Automação CI/CD no GitHub. B-roll insertion experiment. Agendamento para postagem em Youtube Shorts e Tiktok via OAuth.
*   **Critério de Aceite:** Publicação com 1-clique agendada com sucesso. Fila expande automaticamente em picos.

## 7. Backlog Priorizado (Top 5)

| Ordem | Item | Severidade | ROI | Custo | Dependências |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Rate Limiter no Redis | P0 | Muito Alto | Baixo | Instância Redis |
| 2 | Path Traversal Fix e Cleanup FS | P1 | Alto | Baixo | Nenhuma |
| 3 | MediaPipe Face Tracking | P1 | Altíssimo | Alto | Worker GPU/CPU |
| 4 | Upload Assíncrono com AWS S3 / R2 | P2 | Médio | Médio | Setup CDN |
| 5 | Atualização UX: Filtros e Refresh Token | P2 | Alto | Baixo | Banco (Token) |

## 8. Plano de Segurança
*   **Imediato:** Ativação de `helmet`, `cors` e `throttler` (com provedor Redis em `throttler.guard.ts`).
*   **Autenticação:** Substituição por Cookies `httpOnly` para guardar JWT.
*   **Storage:** Assinatura de URIs limitadas em 30 min (Presigned URLs via AWS SDK v3) no lugar de servir streaming direto no app.

## 9. Plano de Performance
*   **Renderização:** Configuração do `REMOTION_CONCURRENCY` atrelado ao número lógico de threads CPU.
*   **WebSockets:** Substituição do `useProjectPolling.ts` por `useProjectSSE.ts` ou WebSocket genuíno para redução de requests desnecessários.

## 10. Plano de Qualidade dos Cortes
*   Implementar Telemetria: A/B Testing passivo no `clip-analyzer` validando "Taxa de Download" contra "Score Sugerido".
*   Fazer com que transcrições rasas emitam flag p/ intervenção humana antes de pular ao Pass 2, economizando chamadas de IA.

## 11. Checklist de Go-Live
*   [ ] Redis Configurado para Rate-Limit global
*   [ ] Path Traversal bloqueado e Presigned URLs ativadas
*   [ ] Tokens acessíveis via Cookie e com rotação implantada
*   [ ] `REMOTION_CONCURRENCY` ajustado
*   [ ] E2E Playwright de um fluxo (Login -> URL -> Video Pronto) verde

## 12. Perguntas em Aberto
*   O Face Tracking tem que processar a totalidade do vídeo ou deve fazer amostragem (1 frame a cada 0.5s)? MediaPipe via Node tem vazamento de memória conhecido se não purgado direito.
*   Quais contas de rede social precisam de aprovação (App Review da Meta/Tiktok) antes que se possa implementar a publicação automatizada?

---
*Relatório processado via IA Autônoma (Gemini 3.1 Pro / Antigravity) para planejamento estratégico da plataforma ViralForge (ViralForge).*
