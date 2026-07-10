# Auditoria ViralForge — MVP para Produção

## 1. Sumário Executivo

- ViralForge é um monorepo TypeScript (pnpm) com 4 apps (web, api, worker) e 4 packages (database, shared, clip-analyzer, render-engine).
- Autenticação básica (JWT + bcrypt), criação de projetos, upload/download, fila BullMQ, pipeline LLM em 2 passagens, render FFmpeg/Remotion.
- **Riscos P0**: Path traversal no download de arquivos (`clips.controller.ts:31` — `response.download(clip.videoPath, ...)` sem sanitização). Ausência total de rate limiting em auth e API. SSRF via YouTube URL sem validação de resposta. Secrets hardcoded no `.env.example` com valores de dev conhecidos. Seed contém senha hardcoded `viralforge123` em `seed.ts:7`.
- **Riscos P1**: Sem proteção contra brute force em login. Sem validação de MIME real em upload (só confia no `mimetype` do multer). Worker sem dead letter queue. Sem observabilidade (só `console.log`). ASR local não implementado — dependência total de OpenAI/OpenRouter. Arquivos em disco (vídeos, áudios, renders, thumbnails) NUNCA são deletados — nem ao remover projeto/clip. Limpeza de `storage/uploads/.temp` ausente.
- **Top 10 decisões**: (1) Implementar rate limit, (2) Sanitizar download de arquivos, (3) Adicionar brute force protection em login, (4) Criar dead letter queue BullMQ, (5) Implementar ASR local (Whisper.cpp), (6) Adicionar observabilidade (logs estruturados + métricas), (7) Mover JWT de localStorage para httpOnly cookie, (8) Adicionar global exception filter, (9) Cleanup de arquivos órfãos em disco ao deletar projetos, (10) Adicionar testes E2E e de segurança.

## 2. Mapa do Sistema Atual

### Arquitetura
```
Web (Next.js 14) → API (NestJS) → Queue (BullMQ/Redis) → Worker (NestJS)
                                                       → FFmpeg / Remotion
                                                       → OpenAI Whisper / YouTube Captions
                                                       → DeepSeek / OpenRouter (LLM)
                    → Postgres (Prisma)
                    → MinIO/S3 (storage)
```

### Fluxo de Processamento
```
1. Cria Projeto (DRAFT)
2. Upload vídeo ou URL YouTube (PENDING)
3. [Worker] Download YouTube / valida arquivo
4. [Worker] Extrai áudio (FFmpeg)
5. [Worker] Transcrição (YouTube captions → fallback ASR)
6. [Worker] Pass 1 LLM (candidatos) → Pass 2 LLM (curadoria)
7. [Worker] Salva clips no banco
8. [Worker] Renderiza clips (FFmpeg ou Remotion)
9. Projeto marcado COMPLETED
10. Front-end exibe resultados + editor
```

## 3. Matriz de Risco

| ID | Severidade | Tipo | Área | Problema | Evidência | Impacto | Correção | Critério de Aceite |
|---|---|---|---|---|---|---|---|---|
| R01 | **P0** | `security` | API/Download | Path traversal no download — `response.download()` usa `clip.videoPath` sem sanitização | `clips.controller.ts:31` — `response.download(clip.videoPath, ...)` | Usuário malicioso pode baixar qualquer arquivo do servidor se conseguir injetar path no banco | Validar que `videoPath` está dentro do diretório permitido; usar `path.resolve` + `startsWith` | Teste de path traversal retorna 403 |
| R02 | **P0** | `security` | Auth/API | Sem rate limiting em nenhum endpoint | Nenhum guard ou middleware de rate limit em qualquer controller | Ataque de brute force em login/register, DoS na API | Adicionar `@nestjs/throttler` ou middleware express-rate-limit com limites por IP | Teste de 100 req/s em login retorna 429 |
| R03 | **P0** | `security` | Upload | Validação MIME confia no `mimetype` do multer (cabeçalho HTTP) | `projects.controller.ts:70` — `ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)` | Atacante pode enviar arquivo malicioso com content-type falsificado | Validar magic bytes reais do arquivo com `file-type` | Upload de .exe com mimetype video/mp4 é rejeitado |
| R04 | **P0** | `security` | Worker/YouTube | SSRF via YouTube URL: valida host mas não valida resposta do youtube-dl | `youtube-download.service.ts:47-52` — só valida hostname, executa youtube-dl | Atacante pode usar URL redirecionada para atingir rede interna | Validar resolução DNS, timeout de conexão, sanitizar redirects | Teste SSRF com IP privado falha |
| R05 | **P0** | `security` | Secrets | `.env.example` contém secrets de dev (`JWT_SECRET=dev-jwt-secret-change-me`) | `.env.example:5` — `JWT_SECRET=dev-jwt-secret-change-me` | Se usado em produção, qualquer um pode forjar JWTs | Remover secrets do `.env.example`; gerar automagicamente | CI falha se detectar secrets conhecidos |
| R06 | **P1** | `security` | Auth | Sem proteção contra brute force em login | `auth.controller.ts:18` — sem delay ou tentativas | Atacante pode testar senhas via força bruta | Implementar throttle por email/IP, delay progressivo | 5 tentativas erradas em 1 min bloqueia por 15min |
| R07 | **P1** | `security` | Auth | Sem validação de força de senha além de `MinLength(8)` | `auth/dto.ts:12` — só `@MinLength(8)` | Senhas fracas (ex: `12345678`) são aceitas | Adicionar validação de complexidade (maiúscula, número, especial) | Senha `12345678` é rejeitada |
| R08 | **P1** | `security` | API/Jobs | Qualquer job na fila pode ser processado sem autenticação adicional | `worker-runner.ts:21` — processa job sem verificar assinatura | Atacante com acesso ao Redis pode enfileirar jobs maliciosos | Adicionar HMAC signature nos jobs BullMQ | Job sem assinatura válida é rejeitado |
| R09 | **P1** | `security` | API/Logs | Secrets podem vazar em logs de erro | `settings.service.ts:385` — `error.message.replace(/(sk-[a-zA-Z0-9]+)/g, 'sk-...')` — só mascara `sk-*` | API keys de outros providers podem vazar em logs | Usar redaction library como `pino-redact` ou `maskdata` | Logs não contêm strings com padrão de API key |
| R10 | **P1** | `worker` | Fila | Sem dead letter queue — jobs com falha permanente são retentados até o limite e depois descartados | `queue.service.ts:17-19` — `removeOnFail: { count: 100 }` — só limpa após 100 falhas | Jobs permanentemente falhos poluem a fila; sem visibilidade para debug | Configurar dead letter queue (DLQ) no BullMQ | Jobs com falha após N tentativas vão para DLQ |
| R11 | **P1** | `architecture` | ASR | ASR local não implementado — dependência total de OpenAI/OpenRouter | `transcription.service.ts:38` — throw se não tem API key | Sem API key = zero processamento de uploads; custo alto; latência | Implementar Faster-Whisper ou Whisper.cpp como fallback local | Projeto processa sem API key externa (com ASR local) |
| R12 | **P1** | `observability` | Worker | Sem logs estruturados, métricas ou tracing — só `console.log` | `worker-runner.ts:31-37` — `console.log` e `console.error` | Impossível depurar falhas em produção sem logs buscáveis | Adicionar Pino/Bunyan para logs estruturados + Prometheus métricas | Worker exporta métricas e logs JSON |
| R13 | **P2** | `security` | Auth | JWT sem refresh token — token único com expiração implícita | `auth.service.ts:49` — `jwtService.signAsync({ sub: user.id, email: user.email })` | Token vaza = acesso permanente até expirar | Implementar refresh token + access token de curta duração | Refresh token rotaciona e access token expira em 15min |
| R14 | **P2** | `security` | Upload | Upload salva em disco local com `renameSync` — sem atomicidade | `projects.controller.ts:97` — `renameSync(file.path, finalPath)` | Se o rename falha entre chamadas concorrentes, pode corromper arquivo | Usar write-atômico com temp file + rename, ou usar S3/MinIO diretamente | Upload concorrente não corrompe arquivo |
| R15 | **P2** | `api` | API | Paginação ausente em listagens de projetos e clips | `projects.service.ts:17-28` — `findMany` sem `skip`/`take` | Usuário com muitos projetos/clips sofre degradação ou timeout | Adicionar paginação cursor-based ou offset em todos os endpoints GET de lista | GET /projects?limit=20&cursor=xxx funciona |
| R16 | **P2** | `worker` | Fila | Sem idempotência — reprocessamento pode duplicar dados | `video-processor.service.ts` — jobs são reprocessados sem dedup | Reprocessamento de job gera clips duplicados | Usar jobId único + verificar se já foi processado (idempotency key) | Reprocessar mesmo job não duplica clips |
| R17 | **P2** | `product` | UX | Páginas de billing, analytics, brand e quality são mockadas | Rotas existem mas sem implementação real | Usuário não pode gerenciar plano, ver métricas ou personalizar marca | Implementar páginas com dados reais ou remover até estar pronto | Páginas removidas ou funcionais |
| R18 | **P2** | `testing` | QA | Testes insuficientes — sem testes de segurança, integração ou E2E | `package.json:17` — script `test` existe mas sem suite definida | Qualquer mudança pode quebrar funcionalidade sem detecção | Adicionar tests unitários, integração API, E2E Playwright | Cobertura > 60% e testes críticos passam |
| R19 | **P3** | `ux` | Front-end | Links de suporte vão para Huawei no rodapé da landing page | `page.tsx` — links de suporte apontam para `support.huawei.com` | Confunde usuários e parece descuido profissional | Corrigir links para apontar para documentação real ou remover | Links apontam para docs reais do produto |
| R20 | **P3** | `refactoring` | Code | Nomes de pacotes ainda usam `@viralforge/*` em vez de `@viralforge/*` | Múltiplos `package.json` — `@viralforge/api`, `@viralforge/worker`, etc | Inconsistência de marca, pode causar confusão em deploy | Renomear packages para `@viralforge/*` | `@viralforge/*` não aparece em lugar nenhum |
| R21 | **P1** | `data` | Storage | Arquivos em disco nunca são limpos — nem ao deletar projeto/clip | `projects.service.ts:71-84` — deleta registros do banco mas não arquivos | Acumulação infinita de storage, vazamento de dados de usuários deletados | Implementar hook pós-delete que remove arquivos do disco/S3 | Deletar projeto remove todos os arquivos associados |
| R22 | **P1** | `data` | Upload | Arquivos temporários em `storage/uploads/.temp` nunca são limpos | `projects.controller.ts:76` — `tempUploadDir()` cria arquivos sem cleanup | Uploads interrompidos acumulam lixo em disco | Implementar TTL/cron para limpeza de `.temp` | Arquivos em `.temp` com >24h são removidos |
| R23 | **P2** | `security` | Seed | Seed tem senha hardcoded (`viralforge123`) para usuário demo | `seed.ts:7` — `bcrypt.hash('viralforge123', 12)` | Usuário demo com senha conhecida é risco se deploy com seed | Gerar senha aleatória via env var ou desabilitar seed em prod | Seed em produção não cria usuário com senha padrão |
| R24 | **P1** | `testing` | QA | Apenas 1 teste unitário existe em todo o monorepo | `packages/clip-analyzer/src/json-parsing.test.ts` — único arquivo `.test.*` | Zero confiança em regressão; qualquer mudança quebra sem detecção | Implementar suite mínima de testes críticos (auth, validação, parsing) | Testes rodam em CI sem falhas |
| R25 | **P2** | `product` | UX | Upload usa `renameSync` — bloqueia event loop do Node.js | `projects.controller.ts:97` — `renameSync(file.path, finalPath)` | Se arquivo é grande ou disco lento, toda a API congela | Usar `fs.promises.rename` ou stream para S3 | Upload de 500MB não bloqueia outras requisições |
| R26 | **P1** | `security` | Auth | JWT armazenado em localStorage via Zustand persist | `auth.store.ts:22` — `persist(...)` salva token no localStorage | Vulnerável a XSS: atacante com script pode roubar token e acessar todas as APIs | Usar httpOnly cookie para refresh token e memory-only para access token | Token não persiste em localStorage |
| R27 | **P1** | `security` | API | Sem global exception filter — stack traces podem vazar | Nenhum `@Catch()` filter registrado no AppModule | Erro não tratado pode expor caminhos de arquivo, SQL queries ou config | Adicionar `AllExceptionsFilter` global que sanitiza resposta em produção | Respostas de erro nunca contêm stack trace |
| R28 | **P2** | `worker` | Fila | Worker não valida payload do job além do tipo TypeScript | `worker-runner.ts:21` — processa job sem schema validation | Job com payload malformado pode crashar o worker | Adicionar validação Zod do payload antes de processar | Job inválido é rejeitado com erro claro |
| R29 | **P2** | `ux` | Front-end | Sem WebSocket — front-end faz polling HTTP a cada 3s | `useProjectPolling.ts:13` — `refetchInterval: 3000` | 20 requisições/min por projeto ativo; não escala com muitos usuários | Implementar WebSocket ou Server-Sent Events para updates de progresso | Front-end recebe updates em tempo real sem polling |
| R30 | **P2** | `api` | API | `uploadFile` no front-end não tem timeout configurado | `api.ts:74-101` — XHR sem timeout | Upload lento pode ficar pendente indefinidamente | Adicionar timeout de 5 minutos no XHR | Upload de 500Mb com rede lenta falha gracejosamente após timeout |

## 4. Auditoria por Área

### 4.1 Produto/UX

**Landing Page**: Bem construída, com preview animado, CTA claro, seções de features, pricing, FAQ e stats. Mas footer tem links para Huawei (aparentemente placeholder esquecido). **P3**.

**Login/Register**: Funcional, mas sem proteção contra brute force. Sem MFA. Sem "esqueci senha". **P1**.

**Dashboard**: Grid de projetos com filtro, busca, toggle grid/lista, empty state, loading skeleton. Bom UX. Sem paginação para muitos projetos. **P2**.

**Criação de projeto**: Modal com formulário completo (título, tipo, estilo, duração, layout, tema). Bom. **OK**.

**Processing page**: Timeline visual bonita com mensagens dinâmicas, progress bar, opção de cancelar. Excelente UX. **OK**.

**Results page**: Score do top clip, grid de clips, status badges. Bom. Faltam: bulk download, publicação social. **P2**.

**Editor profissional**: Abre para editar in/out, layout, tema. Re-render. Funcional. Faltam: preview em tempo real, mais templates. **P2**.

**Settings/Integrações**: Muito robusto — gerencia múltiplos providers IA com teste, ativação, roles PASS1/PASS2. **Excelente**.

**Quality page**: **Funcional** — consome `QualityService` com métricas reais (scores, taxas, distribuição, feedbacks, render time). **OK**.
**Analytics page**: **Funcional** — consome mesma API de qualidade com KPIs e gráfico de distribuição. **OK**.
**Brand page**: **Parcialmente mock** — UI de edição existe mas dados são hardcoded (não persiste no banco). **P2**.
**Billing page**: **Mock** — banner explícito "em desenvolvimento". Planos ilustrativos, sem integração de pagamento. **P2**.

**Mobile**: Layout responsivo. Sidebar colapsa. OK para mobile. **OK**.

### 4.2 Segurança

**Rate limiting**: AUSENTE em toda a API. **P0**. Endpoints de login, register, upload, projetos, clips — todos sem proteção contra abuso.

**JWT**: Guard functional, sem refresh token, sem blocklist/revogacão. `JWT_SECRET` no `.env.example` é `dev-jwt-secret-change-me` — se deploy sem trocar, qualquer um forja token. **P0**.

**Token no localStorage**: Auth store (`auth.store.ts:22`) usa `persist` do Zustand com `name: 'viralforge-auth'` — JWT armazenado em localStorage. Vulnerável a XSS: se atacante injetar script, rouba o token permanente. **P1**.

**Upload**: Valida MIME pelo cabeçalho HTTP (falsificável). Não valida magic bytes. Salva em disco com `renameSync` (sem atomicidade). Path do upload usa `user.id` e `project.id` sem sanitização contra path traversal. **P0**.

**Download**: `response.download(clip.videoPath, ...)` em `clips.controller.ts:31` — usa o caminho do banco diretamente. Se atacante conseguir gravar um path malicioso (ex: via update malicioso), pode ler qualquer arquivo do sistema. **P0**.

**SSRF**: YouTube URL validada por hostname, mas `youtube-dl` segue redirecionamentos. Pode ser usado para atingir rede interna. **P0**.

**Secrets no .env.example**: `JWT_SECRET`, `API_KEY_ENCRYPTION_SECRET`, `MINIO_ROOT_USER/PASSWORD` expostos com valores de dev. **P0**.

**Criptografia API keys**: AES-256-GCM com SHA-256 key derivation. Boa prática. Sem rotação automática. **P2**.

**Prompt injection**: Transcrição do YouTube/ASR vai direto para o LLM. Sem sanitização de entrada. **P2**.

**CORS**: Configurado com allowlist. Bom. **OK**.

### 4.3 API/Backend

**QualityService**: **Robusto** — calcula métricas agregadas (scores, taxas de sucesso/falha, distribuição, feedbacks, render time). Único serviço com dados reais de qualidade. `take: 50` sem paginação pode ser problema com escala. **P2**.

**SettingsController/Service**: **Excelente** — gerencia múltiplos providers IA com teste de conexão, ativação por role (PASS1/PASS2/TRANSCRIPTION), catálogo de providers, fallback legado. Criptografia AES-256-GCM das chaves. **OK**.

**ValidationPipe**: Global com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. **Bom**.

**DTOs**: class-validator com decorators. Faltam exemplos de response DTOs (tipos de retorno não validados). **P2**.

**Tratamento de erros**: Genérico — `try/catch` com `response.status(500).json(...)` em 3 endpoints de clips. Sem filtro global de exceções (`@Catch()`). Erros não tratados podem vazar stack traces em produção. **P1**.

**Paginação**: Ausente em `GET /projects` e `GET /projects/:id/clips`. **P2**.

**Prisma queries**: Sem índices otimizados para buscas frequentes (status, userId + status). **P2**.

**Transações**: Usadas em delete projects/clips. OK. Sem transações em create com múltiplos clips. **P2**.

**Idempotência**: Não há — duplicação de job gera clips duplicados. **P2**.

**Exclusão em cascata**: Prisma `onDelete: Cascade` configurado. Mas arquivos em disco (vídeos, thumbnails, SRT, VTT, ASS, áudio) NUNCA são deletados — `remove()` em `projects.service.ts:71-84` só limpa banco. **P1**.

**renameSync blocking**: `projects.controller.ts:97` usa `renameSync` (versão síncrona) que bloqueia event loop durante operação de I/O. Uploads grandes congelam a API. **P2**.

### 4.4 Worker/Fila

**ClipValidationService**: **Excelente** — validação em português com detecção de abertura/fechamento fraco, ajuste para boundaries de sentenças, similaridade de texto, deduplicação. Heurísticas específicas para PT-BR (lista de `weakStarts` e `weakEndings` em português). **OK**.

**BullMQ**: Producer e Worker configurados. Concorrência configurável por env.

**Retentativas**: 3 attempts para process-video, 2 para render-clip. Backoff exponencial. OK.

**Stalled jobs**: Sem tratamento específico. Timeouts básicos por stale cutoff. **P2**.

**Dead letter queue**: AUSENTE. Jobs com falha permanente são retentados até o limite e descartados. **P1**.

**Idempotência**: Jobs não têm idempotency key. Reprocessar o mesmo job duplica clips. **P2**.

**Progress reporting**: Salva no banco via `stage()`. Funcional. Sem WebSocket para front-end (polling HTTP). **P2**.

**Resiliência API externa**: Se LLM ou ASR falham, o worker falha e retenta. Se YouTube captions falham, tenta ASR. Bom. Mas sem fallback local para ASR. **P1**.

**Controle de custo**: Sem limite de gasto por usuário em chamadas LLM/ASR. **P2**.

**CPU/Memória**: Configurável via env. Concorrência de render separada. OK.

### 4.5 ASR/Transcrição

**YouTube captions**: Implementado, com fallback de idioma (pt-BR → pt → en). Qualidade avaliada por heurística (score 0-100). **Bom**.

**ASR externo**: OpenAI Whisper via API. Suporta chunking para arquivos >25MB. **Bom**.

**ASR local**: AUSENTE. Dependência total de API externa. **P1**.

**Precisão PT-BR**: Usa OpenAI Whisper que tem boa precisão para PT-BR. Heurística de qualidade detecta transcrição degradada. **OK**.

**Timestamps word-level**: Implementado com fallback para aproximação linear. **OK**.

### 4.6 IA/Qualidade dos Cortes

**Pipeline LLM 2-passagens**: Arquitetura sólida. Pass 1 pré-seleciona candidatos, Pass 2 faz curadoria profunda. **Excelente**.

**Prompts**: System prompt genérico, templates por pass. Pass 1 usa temperatura 0.55, Pass 2 usa 0.35. **Bom**.

**Schemas Zod**: Validação rigorosa com fallback resiliente. Parsing JSON robusto com `extractFirstBalancedObject`. **Excelente**.

**Fallback offline**: Modo offline gera clips sintéticos para teste de pipeline. **OK**.

**Fallback operacional**: Se Pass1/Pass2 falham, `buildOperationalFallbackClips()` cria clips baseados em segmentos. **Bom**.

**Score composicional**: Opening 30% + Closing 30% + Quotability 20% + Context 10% + Emotional 10%. **OK**.

**Deduplicação**: Overlap ratio > 75% deduplica. **OK**.

**Prompt injection**: Transcrição vai diretamente pro LLM. Risco de injection via título/texto. **P2**.

**Telemetria Pass1/Pass2**: Apenas log. Sem métricas agregadas. **P2**.

**Dataset de avaliação**: Não existe. Sem ground truth humano. **P2**.

### 4.7 Render/Vídeo

**FFmpeg**: Layouts: blurred background, fill crop, center fit, top frame. Subtitles via ASS. Áudio com loudnorm. **Bom**.

**Remotion**: Implementado como render alternativo (experimental). Fallback para FFmpeg se falhar. **OK**.

**Legendas animadas**: 10 temas com animações (highlight, scale-pop, karaoke, etc). **Excelente**.

**Smart reframing**: Constante `SMART_REFRAME` existe no enum mas não implementado no FFmpeg. **P2**.

**Face tracking**: Ausente. **P2**.

**Thumbnails**: Geradas no start+2s. **OK**.

**Player**: Vídeo nativo do navegador. **OK**.

**Range requests**: Não implementado — download direto. **P2**.

**SubtitleService**: Excelente — gera SRT, VTT e ASS com 10 temas de legenda. Suporte a `wrapText` com quebra inteligente (evita preposição no fim da linha). **OK**.

### 4.8 Front-end/Design System

**Tailwind tokens**: Design tokens consistentes (ink-primary, ink-secondary, accent, surface, etc). **Bom**.

**Componentes primitivos**: Button, Input, Skeleton, StatusBadge. **OK**.

**Layout shell**: Sidebar com navegação, responsivo. **OK**.

**Dashboard**: Grid com busca, filtro, toggle visualização. **Bom**.

**Processing page**: Timeline visual com etapas claras, mensagens contextuais, progresso. **Excelente**.

**Settings page**: Muito bem feita — gerenciamento de providers IA com teste, ativação, roles. **Excelente**.

**Acessibilidade**: Labels aria ausentes em alguns controles. Foco visível. **P3**.

**Performance React**: TanStack Query com cache. Zustand para auth. OK.

### 4.9 Banco/Dados

**Schema**: User, Project, Transcript, Clip, ClipFeedback, ProcessingJob, AiProviderIntegration. Relacionamentos com cascade. **OK**.

**Índices**: Presentes em userId, projectId, status, provider, role. Mas faltam índices compostos (ex: `(userId, status)` para queries de dashboard). **P2**.

**Multi-tenancy**: Por userId via `findFirst({ where: { userId } })`. Correto.

**Integridade de status**: Enums ProjectStatus, ClipStatus, ProcessingStatus. Transições manuais no código. Sem state machine formal. **P2**.

**Storage path**: Armazenado no banco. Orfão se projeto deletado mas arquivo não. **P1**.

**Retenção**: Sem política de limpeza de arquivos antigos. **P2**.

**Tabelas ausentes**: plans, subscriptions, usage/quotas, audit_log, social_accounts, exports. **P2**.

### 4.10 DevOps/Produção

**Docker**: Infra (Postgres, Redis, MinIO) em docker-compose. Aplicação roda fora do Docker (dev). Sem Dockerfile para produção. **P2**.

**Env**: 23 variáveis. Secrets no `.env.example`. Sem `.env.production` template. **P1**.

**Deploy**: Sem config de deploy (Dockerfile, K8s, Vercel, Railway). **P2**.

**Storage**: MinIO configurado mas não implementado no código (usa disco local). **P2**.

**Backup Postgres**: Sem script. **P2**.

**Observabilidade**: Só console.log. Sem logs estruturados, métricas, tracing, alertas. **P1**.

**Health checks**: Ausentes. **P2**.

**CI/CD**: Sem pipeline configurada além de scripts npm. **P2**.

### 4.11 Testes

**Unitários**: Não encontrados. Script `test` existe mas sem implementação. **P1**.

**Integração API**: Não existem. **P2**.

**Worker com fixtures**: Não existem. **P2**.

**E2E Playwright**: Não existem. **P2**.

**Segurança**: Não existem testes de penetração ou auth bypass. **P1**.

**Prompt regression**: Não existem. Pass1/Pass2 podem degradar sem detecção. **P2**.

### 4.12 Billing/Quotas

**Planos**: Mockados na landing page (Starter/Pro/Studio). Sem implementação real. **P2**.

**Limites de minutos**: Sem enforcement. **P1**.

**Cobrança real**: Stripe/MercadoPago não integrados. **P2**.

**Histórico de uso**: Sem tabela de usage. **P2**.

**Bloqueios por plano**: Sem middleware de verificação de quota. **P1**.

**Proteção contra custo infinito**: Sem limite de gasto por usuário em LLM/ASR. **P1**.

## 5. Comparativo Competitivo

| Feature | ViralForge atual | OpusClip | Vizard | Klap | Vidyo.ai | Captions | Gap | Prioridade |
|---|---|---|---|---|---|---|---|---|
| Corte automático com IA | ✔ (2-pass LLM) | ✔ | ✔ | ✔ | ✔ | ✔ | — | — |
| Legendas animadas | ✔ (10 temas) | ✔ | ✔ | ✔ | ✔ | ✔ (melhor) | Animações word-level | P2 |
| PT-BR nativo | ✔ | ✗ | ✗ | ✗ | ✗ | ✗ | **Diferencial** | P0 |
| Smart reframing | ✗ (parcial) | ✔ | ✔ | ✔ | ✔ | ✔ | Detecção de rosto/falante | P1 |
| B-roll automático | ✗ | ✔ | ✔ | ✗ | ✔ | ✔ | Inserção de imagens de apoio | P2 |
| Publicação social | ✗ | ✔ | ✔ | ✔ | ✔ | ✔ | Post direto para redes | P1 |
| Scheduler | ✗ | ✔ | ✔ | ✔ | ✔ | ✔ | Agendamento de posts | P2 |
| Brand kit | ✗ (mockado) | ✔ | ✔ | ✔ | ✔ | ✔ | Cores/logos consistentes | P2 |
| ASR local | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Diferencial de custo | P1 |
| API pública | ✗ | ✔ | ✔ | ✔ | ✔ | ✔ | Integração terceiros | P3 |
| Preço em R$ | ✔ (mock) | ✗ (USD) | ✗ (USD) | ✗ (USD) | ✗ (USD) | ✗ (USD) | **Diferencial** | P0 |
| Face tracking | ✗ | ✔ | ✔ | ✗ | ✔ | ✔ | Closeup automático | P1 |
| Template library | ✗ | ✔ | ✔ | ✔ | ✔ | ✔ | Reutilização de estilos | P3 |

## 6. Roadmap de Produção por Fases

### Fase 1: Segurança e Estabilização (Semanas 1-2)
**Objetivo**: Eliminar riscos P0/P1 que podem causar perda de dados ou brecha de segurança.

**Entregáveis**:
1. Rate limiting (express-rate-limit ou @nestjs/throttler) em auth e API geral
2. Path traversal fix no download (validar caminho)
3. Magic byte validation no upload (file-type)
4. Remover secrets do .env.example, gerar automagicamente
5. Sanitizar URL do YouTube contra SSRF (validar resolução DNS, limitar redirects)
6. Dead letter queue no BullMQ
7. Logs estruturados (Pino/Bunyan)
8. Bloquear brute force em login (delay, bloqueio temporário)

**Arquivos**: `clips.controller.ts`, `projects.controller.ts`, `auth.controller.ts`, `auth.service.ts`, `youtube-download.service.ts`, `queue.service.ts`, `.env.example`, `worker-runner.ts`

**Dependências**: Nenhuma

**Complexidade**: M

**Critério de aceite**: Nenhum P0/P1 aberto. Teste de segurança passa sem falhas.

### Fase 2: Resiliência do Worker (Semanas 3-4)
**Objetivo**: Worker não pode depender 100% de APIs externas.

**Entregáveis**:
1. Implementar ASR local (Whisper.cpp ou Faster-Whisper)
2. Idempotência de jobs (jobId único + dedup)
3. Dead letter queue com alerta
4. Timeout granular por etapa do worker
5. Cleanup de arquivos órfãos ao deletar projeto

**Arquivos**: `transcription.service.ts`, `video-processor.service.ts`, `projects.service.ts`, `queue.service.ts`

**Dependências**: Fase 1

**Complexidade**: G

**Critério de aceite**: Projeto processa sem API key externa. Reprocessar job não duplica dados.

### Fase 3: Produto e UX (Semanas 5-6)
**Objetivo**: Fechar gaps competitivos mais críticos.

**Entregáveis**:
1. Publicação social (YouTube, TikTok, Instagram via API)
2. Páginas de billing, analytics, brand, quality funcionais
3. Paginação em listagens
4. Refresh token JWT
5. Corrigir links Huawei no footer
6. Renomear packages para @viralforge/*

**Arquivos**: `apps/web/src/app/(dashboard)/dashboard/billing/page.tsx`, `analytics/page.tsx`, `brand/page.tsx`, `quality/page.tsx`, `auth.service.ts`, `page.tsx`, múltiplos `package.json`

**Dependências**: Fase 2

**Complexidade**: M

**Critério de aceite**: Páginas mockadas têm conteúdo real. Social publish funcional para 1 plataforma.

### Fase 4: Qualidade dos Cortes (Semanas 7-8)
**Objetivo**: Melhorar qualidade dos cortes para competir com OpusClip/Vizard.

**Entregáveis**:
1. Dataset interno de avaliação (50 vídeos, ground truth humano)
2. A/B test de modelos LLM (comparar deepseek-chat vs openrouter vs gemini)
3. Métricas de qualidade (precision, recall dos cortes)
4. Smart reframing (detecção de rosto com face-api.js ou MediaPipe)
5. Face tracking para closeup automático
6. Template library (salvar/configurações de estilo)

**Arquivos**: `packages/clip-analyzer/src/`, `packages/render-engine/src/`, `apps/worker/src/services/rendering.service.ts`

**Dependências**: Fase 2

**Complexidade**: GG

**Critério de aceite**: Precision > 80% no dataset de avaliação. Face tracking funcional.

### Fase 5: Produção e DevOps (Semanas 9-10)
**Objetivo**: Preparar para produção real.

**Entregáveis**:
1. Dockerfile para web, API, worker
2. Docker Compose de produção
3. Health checks em todos os serviços
4. CI/CD pipeline (GitHub Actions)
5. MinIO/S3 integration (storage externo)
6. Backup automático do Postgres
7. Monitoramento (Prometheus + Grafana + Sentry)
8. Migração de banco automatizada

**Arquivos**: `infra/`, `Dockerfile.*`, `.github/workflows/`, `docker-compose.prod.yml`

**Dependências**: Fase 3

**Complexidade**: G

**Critério de aceite**: Deploy completo em staging com todos os serviços rodando.

### Fase 6: Monetização e Quotas (Semanas 11-12)
**Objetivo**: Produto pronto para cobrar.

**Entregáveis**:
1. Integração Stripe/MercadoPago
2. Tabela de plans, subscriptions, usage
3. Middleware de quota por plano (minutos, projetos, renders)
4. Proteção contra custo infinito (limite de gasto LLM/ASR)
5. Histórico de uso e faturamento

**Arquivos**: `prisma/schema.prisma`, `apps/api/src/billing/`, `apps/api/src/quotas/`, `apps/web/src/app/(dashboard)/dashboard/billing/`

**Dependências**: Fase 4

**Complexidade**: G

**Critério de aceite**: Usuário pode assinar, usar, e ser cobrado. Quotas são enforced.

## 7. Backlog Priorizado

| Ordem | Item | Severidade | ROI | Custo | Dependências | Aceite |
|---|---|---|---|---|---|---|
| 1 | Rate limiting (auth + API) | P0 | Alto | Baixo | Nenhuma | 429 em excesso de req |
| 2 | Path traversal fix no download | P0 | Alto | Baixo | Nenhuma | Path traversal test passa |
| 3 | Magic byte validation no upload | P0 | Alto | Baixo | Nenhuma | .exe com mimetype falso rejeitado |
| 4 | Remover secrets do .env.example | P0 | Alto | Baixo | Nenhuma | CI detecta e falha |
| 5 | SSRF fix no YouTube download | P0 | Alto | Médio | Nenhuma | Redirect para IP privado bloqueado |
| 6 | Dead letter queue | P1 | Alto | Baixo | Nenhuma | Jobs falhos vão para DLQ |
| 7 | Brute force protection login | P1 | Alto | Baixo | Nenhuma | 5 tentativas = bloqueio 15min |
| 8 | ASR local (Whisper.cpp) | P1 | Alto | Alto | Nenhuma | Processa sem API key |
| 9 | Logs estruturados | P1 | Alto | Médio | Nenhuma | Logs em JSON buscáveis |
| 10 | Job idempotência | P2 | Alto | Médio | Fase 1 | Reprocessar não duplica |
| 11 | Paginação em listagens | P2 | Médio | Baixo | Nenhuma | ?limit=20&cursor=xxx |
| 12 | Refresh token JWT | P2 | Médio | Médio | Nenhuma | Token rotaciona |
| 13 | Limpeza de arquivos órfãos | P1 | Alto | Médio | Nenhuma | Deletar projeto = deletar arquivos |
| 14 | renameSync → fs.promises.rename (não bloquear event loop) | P2 | Médio | Baixo | Nenhuma | Upload não bloqueia outras requests |
| 15 | Social publishing (YouTube) | P1 | Alto | Alto | Fase 2 | Post direto para YouTube |
| 16 | Páginas mockadas (billing, brand) | P2 | Médio | Médio | Fase 2 | Conteúdo real ou removidas |
| 17 | Dataset de avaliação de cortes | P2 | Alto | Alto | Fase 3 | 50 vídeos com ground truth |
| 18 | Smart reframing | P1 | Alto | Alto | Fase 3 | Detecção de rosto funcional |
| 19 | Dockerfile produção | P2 | Alto | Médio | Fase 3 | Build e deploy em staging |
| 20 | CI/CD pipeline | P2 | Alto | Médio | Fase 4 | Testes + build automático |
| 21 | Integração Stripe/MercadoPago | P1 | Alto | Alto | Fase 4 | Cobrança real funcional |
| 22 | Quotas por plano | P1 | Alto | Médio | Fase 5 | Limite de minutos enforced |
| 23 | Face tracking | P2 | Médio | Alto | Fase 3 | Closeup automático |
| 24 | Testes E2E Playwright | P2 | Alto | Alto | Fase 5 | Fluxo completo testado |
| 25 | Global exception filter (evitar vazar stack traces) | P1 | Alto | Baixo | Nenhuma | Erro nunca expõe stack trace |
| 26 | Mover JWT de localStorage para httpOnly cookie | P1 | Alto | Alto | Fase 1 | Token não fica acessível via JS |
| 27 | WebSocket para progresso em tempo real | P2 | Médio | Alto | Fase 3 | Front-end recebe updates sem polling |
| 28 | Timeout no upload front-end (XHR) | P2 | Médio | Baixo | Nenhuma | Upload travado falha após 5min |
| 29 | Validação Zod de payload do worker | P2 | Médio | Baixo | Fase 1 | Job inválido é rejeitado |
| 30 | Renomear @viralforge para @viralforge | P3 | Baixo | Médio | Fase 2 | Sem referência a viralforge |
| 31 | Limpeza de .temp uploads | P2 | Médio | Baixo | Nenhuma | Arquivos .temp >24h removidos |

## 8. Plano de Segurança

### Correções Imediatas (P0 - 48h)
1. **Rate limiting** — Adicionar @nestjs/throttler nos controllers de auth e API. Limites: 10 req/min em login, 100 req/min no restante.
2. **Path traversal no download** — Validar que `clip.videoPath` está dentro de `STORAGE_ROOT` usando `path.resolve` + `startsWith`.
3. **Magic bytes no upload** — Usar `file-type` package para validar o tipo real do arquivo antes de salvar.
4. **Secrets no .env.example** — Substituir todos os valores sensíveis por placeholders tipo `<your-jwt-secret>`.
5. **SSRF no YouTube** — Validar resolução DNS do host, timeout de 10s, bloquear IPs privados.

### Hardening de Auth (P1 - 1 semana)
1. Brute force protection: throttle por email + IP com exponential backoff.
2. Força de senha: regex para maiúscula, minúscula, número, especial.
3. Refresh token implementado.
4. Session invalidation (token blocklist no Redis).
5. Rate limit por usuário autenticado (quotas).

### Hardening de Upload/Download (P1 - 1 semana)
1. Validar magic bytes com `file-type`.
2. Limitar tamanho por upload (já tem 500MB, bom).
3. Sanitizar nome de arquivo (remover path traversal).
4. Streaming de arquivos com range requests.
5. Autorização: verificar ownership antes de servir arquivo (já faz, mas confirmar).

### Hardening de Worker/Jobs (P1 - 2 semanas)
1. HMAC signature em jobs BullMQ para prevenir job spoofing.
2. Dead letter queue com notificação.
3. Timeout por etapa (download, transcrição, análise, render).
4. Validação de payload do job antes de processar.

### Hardening de Secrets (P2 - 2 semanas)
1. Implementar rotação de chaves (API_KEY_ENCRYPTION_SECRET versioned).
2. Mascaramento completo de secrets em logs (não só `sk-*`).
3. Auditoria de acesso a secrets (logs de descriptografia).
4. Secrets não no código — usar vault ou variáveis de ambiente.

## 9. Plano de Performance

### Gargalos por Etapa
| Etapa | Gargalo | Impacto | Solução |
|---|---|---|---|
| Download YouTube | Rede + youtube-dl | Altíssimo (pode levar minutos) | Cache de downloads, paralelismo |
| Extração áudio | CPU (FFmpeg) | Médio | Já usa threads configuráveis |
| Transcrição ASR | Rede (API externa) | Alto (dependência externa) | ASR local, chunking |
| Pass 1 LLM | Rede + modelo | Alto (contexto grande) | Seleção inteligente de segmentos (já faz) |
| Pass 2 LLM | Rede + modelo | Médio (contexto pequeno) | Modelo mais barato |
| Render FFmpeg | CPU | Alto (vários clips) | Concorrência configurável (já tem) |
| Render Remotion | CPU + RAM | Muito alto | Usar FFmpeg como default, Remotion como fallback |

### Métricas a Coletar
- Duração de cada etapa do pipeline
- Latência de API externa (LLM, ASR)
- CPU/memória do worker
- Taxa de sucesso por etapa
- Custo por projeto (tokens LLM + ASR minutos)

### Otimizações Recomendadas
1. Cache de transcrições para mesmo vídeo (hash do conteúdo)
2. Model routing: usar modelo barato no Pass 1, caro no Pass 2
3. Render paralelo (já implementado com `RENDER_CLIP_CONCURRENCY`)
4. FFmpeg preset `veryfast` (já configurado)
5. Considerar GPU para render (NVIDIA NVENC) se escala

## 10. Plano de Qualidade dos Cortes

### Métricas
- **Precision**: % de clips aprovados pelo usuário (feedback)
- **Recall**: % de momentos "virais" capturados vs ground truth
- **Score médio**: média dos `finalScore` dos clips
- **Taxa de revisão**: % de clips marcados como `needs_review`
- **Token consumo**: média de tokens por projeto (para custo)

### Dataset de Avaliação
1. Coletar 50 vídeos de diferentes tipos (podcast, entrevista, live, aula)
2. Anotar manualmente os 3-5 melhores cortes de cada vídeo (ground truth)
3. Comparar automaticamente com output do pipeline (precision/recall)
4. Versionar dataset e reavaliar a cada mudança de prompt/modelo

### A/B Test
- Comparar modelos: deepseek-chat vs openrouter/gpt-oss vs gemini-2.0-flash
- Comparar temperaturas: Pass 1 (0.4, 0.55, 0.7), Pass 2 (0.2, 0.35, 0.5)
- Métrica: precision no dataset + token cost

### Prompt Improvements
1. Pass 1: melhorar detecção de boundary (início/fim naturais de fala)
2. Pass 2: melhorar avaliação de "context independence" (corte funciona sem contexto?)
3. Adicionar exemplos few-shot no system prompt
4. Testar Chain-of-Thought no Pass 2

### Model Routing
- Pass 1: modelo barato (DeepSeek Chat, Qwen Turbo, Gemini Flash)
- Pass 2: modelo mais caro (DeepSeek Reasoner, GPT-4o-mini, Claude Haiku)
- Fallback: se Pass 2 falha, usar Pass 1 com validação relaxada

## 11. Checklist de Go-Live

### Segurança
- [ ] Seed de banco não cria usuário com senha hardcoded em produção
- [ ] `renameSync` substituído por `fs.promises.rename` (não bloquear event loop)
- [ ] JWT armazenado em httpOnly cookie (não localStorage)
- [ ] Global exception filter registrado (não vazar stack traces)
- [ ] Timeout configurado no upload front-end (XHR)
- [ ] Rate limiting implementado e testado
- [ ] Path traversal fix aplicado
- [ ] Magic bytes validation no upload
- [ ] SSRF validation no YouTube download
- [ ] Secrets removidos do código/ `.env.example`
- [ ] Headers de segurança (CSP, HSTS, X-Frame-Options)
- [ ] JWT com refresh token e revogação
- [ ] Login com brute force protection
- [ ] Senhas com validação de força
- [ ] Jobs BullMQ com HMAC signature
- [ ] Logs sem vazamento de secrets
- [ ] Upload/download com autorização verificada

### Infraestrutura
- [ ] Dockerfile para web, API, worker
- [ ] Docker Compose de produção
- [ ] Health checks em todos os serviços
- [ ] Backup automático do Postgres
- [ ] Redis com persistência (AOF/RDB)
- [ ] MinIO/S3 para storage de vídeos (não disco local)
- [ ] Variáveis de ambiente validadas no startup
- [ ] CI/CD pipeline funcional

### Observabilidade
- [ ] Logs estruturados (JSON) em todos os serviços
- [ ] Métricas exportadas (Prometheus)
- [ ] Dashboard Grafana (CPU, memória, fila, latência)
- [ ] Alertas configurados (falha de job, latência alta)
- [ ] Sentry ou similar para error tracking
- [ ] Health check endpoints expostos

### Produto
- [ ] Billing funcional com integração de pagamento
- [ ] Quotas por plano enforced
- [ ] Páginas mockadas removidas ou implementadas
- [ ] Publicação social funcional (mínimo 1 plataforma)
- [ ] Suporte a PT-BR testado
- [ ] Mobile responsivo verificado
- [ ] Acessibilidade básica (labels, foco, teclado)

### Testes
- [ ] Testes unitários para serviços críticos (auth, clips, worker)
- [ ] Testes de integração para endpoints principais
- [ ] Testes de segurança (auth bypass, path traversal, rate limit)
- [ ] E2E Playwright para fluxo principal (criar projeto → upload → ver clips)
- [ ] Prompt regression tests (dataset de avaliação)
- [ ] Testes de carga (worker com múltiplos jobs simultâneos)

### Storage e Dados
- [ ] Cleanup de arquivos órfãos ao deletar projeto (vídeos, áudios, renders, thumbnails)
- [ ] Limpeza programada de `storage/uploads/.temp` (uploads interrompidos)
- [ ] `renameSync` substituído por `fs.promises.rename` em `projects.controller.ts`
- [ ] Política de retenção de dados (vídeos, logs)
- [ ] Política de backup e restore

### Processo
- [ ] Runbook de incidentes
- [ ] Monitoramento de custo (LLM/ASR por usuário)
- [ ] Processo de rollback documentado

## 12. Perguntas em Aberto

1. **Escala esperada**: Quantos usuários simultâneos? Quantos projetos por dia? Isso define prioridade de performance.
2. **Orçamento de infra**: Quanto pode gastar por mês em cloud/LLM? Define trade-off entre ASR local vs API.
3. **Público-alvo primário**: Criador individual (B2C) vs agência (B2B)? Define features de team/workspace.
4. ** Monetização imediata**: Precisa cobrar já ou pode lançar free primeiro? Define urgência de billing.
5. **Região dos usuários**: Brasil apenas ou internacional? Se internacional, PT-BR deixa de ser diferencial.
6. **Time disponível**: Quantas pessoas para implementar? Define velocidade do roadmap.
7. **ASR local**: Prefere Whisper.cpp (C++, mais rápido) ou Faster-Whisper (Python, mais fácil)? Impacta stack.
8. **GPU disponível**: Tem acesso a GPU para render/ASR? Se sim, priorizar NVENC e Whisper.cpp com CUDA.
9. **Deadline**: Quando precisa estar em produção? Define o que entra ou não no MVP.
10. **Nome definitivo**: ViralForge é o nome final? Confirma para renomear packages.
