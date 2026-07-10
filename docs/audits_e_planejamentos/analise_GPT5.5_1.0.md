# Análise GPT-5.5 1.0 — CLIPIA vs Concorrentes

Data: 2026-05-21  
Escopo: análise ponta a ponta do sistema CLIPIA no repositório local e comparação competitiva com Opus Clip, Vizard, Klap e ferramentas similares.

## Validação Técnica Executada

Comandos executados:

```bash
corepack pnpm -r test
corepack pnpm -r typecheck
```

Resultado:

- Testes passaram.
- Typecheck passou.
- Não foi executado um processamento real com vídeo neste turno; a análise foi baseada em arquitetura, código, fluxos implementados e fontes públicas atuais dos concorrentes.

## Fontes Públicas Consultadas

- Opus Clip pricing/features: https://www.opus.pro/pricing
- Opus Clip data security: https://help.opus.pro/docs/article/opusclip-data-security-standards
- Vizard API docs: https://docs.vizard.ai/docs/introduction
- Vizard auto-schedule: https://help.vizard.ai/en/articles/10848181-auto-schedule-post-ai-clips
- Klap pricing: https://klap.app/pricing

## Resumo Executivo

O CLIPIA hoje é competitivo como produto técnico/MVP avançado, especialmente para PT-BR, pipeline próprio, BYOK e controle de custo. Mas ainda não está no nível de Opus Clip/Vizard como SaaS maduro.

Ranking geral atual:

| Rank | Produto | Nota Geral | Diagnóstico |
|---:|---|---:|---|
| 1 | Opus Clip | 9.1 | Mais completo: multimodal clipping, reframe, B-roll, scheduler, brand, API/enterprise, SOC 2 |
| 2 | Vizard | 8.4 | Forte em API, workflow, social scheduling e times |
| 3 | Klap | 8.0 | Muito bom para criadores, simples, barato, dublagem/tradução forte |
| 4 | CLIPIA | 7.2 | Base técnica forte, PT-BR e IA em 2 passes; falta escala, CV real e distribuição multicanal |
| 5 | Munch/Submagic/Captions-like | 7.0-8.0 | Variam por foco: captions, marketing, repurpose, edição |

## Por Que Opus Está Na Frente

Opus Clip declara recursos que o CLIPIA ainda não cobre integralmente:

- ClipAnything/multimodal por fala, objetos, som e emoção.
- Virality score.
- Auto hook.
- Captions animadas.
- AI reframe.
- Dynamic layout switch.
- B-roll.
- Text/timeline editor.
- Social scheduler.
- Brand assets.
- API.
- Segurança SOC 2 Type II.

Vizard também tem vantagem clara em workflow/API:

- Clipping automático.
- Legendas.
- Personalização.
- Templates.
- Export social.
- API REST.
- Scheduler para TikTok, YouTube, Instagram, Facebook, X e LinkedIn, com regras de score e calendário.

Klap compete forte em simplicidade/preço:

- Planos públicos com 100 a 1000 clips/mês.
- 4K em planos superiores.
- Tradução/dublagem em 29 idiomas.

## Notas Por Característica

| Critério | CLIPIA | Opus Clip | Vizard | Klap | Comentário CLIPIA |
|---|---:|---:|---:|---:|---|
| IA de detecção de momentos | 8.0 | 9.5 | 8.5 | 8.2 | CLIPIA tem Pass 1/Pass 2, validação semântica e scoring granular |
| Score viral | 7.8 | 9.3 | 8.2 | 7.8 | Bom no texto; falta multimodal real com áudio/vídeo |
| Legendas | 8.0 | 9.0 | 8.2 | 8.0 | CLIPIA tem Remotion/word timestamps, mas precisa mais polimento visual |
| Reframe / face tracking | 5.5 | 9.2 | 8.2 | 7.5 | CLIPIA tem layout smart/heurístico, mas não visão computacional real |
| Editor | 6.7 | 8.8 | 8.5 | 7.3 | Ajuste de timing/layout existe; falta edição por texto/timeline robusta |
| B-roll / efeitos | 3.0 | 8.8 | 7.0 | 6.5 | CLIPIA praticamente não tem B-roll automático competitivo |
| Publicação social | 5.0 | 9.0 | 9.0 | 7.0 | CLIPIA tem YouTube; faltam TikTok, Instagram, LinkedIn, X, calendário avançado |
| Brand kit | 6.5 | 8.8 | 8.0 | 7.0 | Backend existe; precisa fechar UX e aplicar consistentemente |
| Segurança | 7.0 | 9.2 | 8.0 | 7.5 | Boa base: JWT, bcrypt, CORS, rate limit, AES-GCM; falta SOC 2, SSO, MFA, cookies httpOnly |
| UX | 7.3 | 9.0 | 8.4 | 8.2 | Dashboard bom; falta onboarding, empty states comerciais e workflow bulk |
| UI | 7.6 | 9.0 | 8.2 | 8.0 | Visual atual é bom, mas ainda parece produto em construção em algumas telas |
| Escalabilidade | 6.3 | 9.0 | 8.8 | 8.0 | Arquitetura é boa, mas ainda depende muito de setup local/worker/storage próprio |
| Billing/monetização | 5.8 | 8.5 | 8.0 | 8.0 | Stripe existe no backend, mas precisa virar produto acabado |
| API pública | 4.5 | 8.0 | 9.0 | 7.5 | Internamente tem API, mas não há API pública/documentada para clientes |
| Custo/valor | 8.5 | 7.0 | 8.0 | 8.5 | CLIPIA pode vencer com preço em reais + BYOK + foco PT-BR |

Nota final CLIPIA: **7.2/10**

## O Que O CLIPIA Já Faz Bem

- Pipeline completo: projeto, upload/YouTube, extração de áudio, transcrição, análise IA, geração de clips, render, download e publicação YouTube.
- Arquitetura sólida em monorepo: web Next.js, API NestJS, worker NestJS, BullMQ, Prisma, Postgres, Redis, MinIO/local storage.
- IA bem desenhada: Pass 1 gera candidatos, Pass 2 faz curadoria, schema Zod valida respostas, fallback operacional evita pipeline quebrar.
- Diferencial PT-BR: prompts, heurísticas e UX parecem pensados para criador brasileiro.
- Multi-provider: DeepSeek, OpenRouter, NVIDIA, Google, Qwen, Kimi, MiniMax e transcrição configurável.
- Render flexível: FFmpeg e Remotion, legendas SRT/VTT/ASS, word-level captions quando disponíveis.
- Segurança básica melhor que MVP comum: bcrypt, JWT, CORS allowlist, ValidationPipe, magic bytes no upload, path safety em downloads, criptografia AES-256-GCM para secrets.
- Operação: fila com retry, DLQ, healthcheck, stale job handling e typecheck/testes passando.

## Arquivos Centrais Analisados

- `apps/worker/src/services/video-processor.service.ts`
- `packages/clip-analyzer/src/llm-clip-analyzer.service.ts`
- `apps/api/src/projects/projects.controller.ts`
- `apps/api/src/clips/clips.controller.ts`
- `apps/api/src/publish/publish.service.ts`
- `packages/database/prisma/schema.prisma`
- `apps/worker/src/services/rendering.service.ts`
- `apps/worker/src/services/remotion-render.service.ts`
- `apps/worker/src/services/face-detection.service.ts`
- `apps/worker/src/services/transcription.service.ts`
- `apps/api/src/billing/billing.service.ts`
- `apps/api/src/quota/quota.service.ts`
- `packages/shared/src/secrets.ts`

## Diagnóstico Técnico Ponta a Ponta

### Web / UX

O frontend tem uma base boa:

- Landing page com narrativa clara para criadores PT-BR.
- Dashboard de projetos com busca, grid/lista, skeletons e estados vazios.
- Página de processamento com timeline e mensagens contextuais.
- Página de resultado com ranking de clips e score.
- Editor por clip com ajuste de timing/layout/tema.
- Settings de providers bem acima de MVP comum.

Lacunas:

- Algumas páginas ainda parecem parciais ou produto em construção.
- Falta onboarding guiado.
- Falta bulk workflow: baixar todos, renderizar todos, publicar vários, agendar lote.
- Falta editor por texto/timeline de nível profissional.
- Falta preview mais próximo de tempo real.

### API / Backend

Pontos fortes:

- NestJS modular.
- DTOs e ValidationPipe global.
- CORS allowlist.
- Autenticação JWT com bcrypt.
- Criptografia de API keys e tokens OAuth com AES-256-GCM.
- Ownership checks em projetos/clips.
- Validação de magic bytes em upload.
- Safe path em downloads.
- Quotas e billing modelados.
- Publicação YouTube com OAuth.

Lacunas:

- JWT em localStorage no frontend ainda é inferior a httpOnly cookies + refresh rotation.
- Falta MFA.
- Falta SSO/SAML para enterprise.
- Falta audit log.
- Falta RBAC/workspaces.
- Falta API pública versionada/documentada.
- Falta paginação robusta para escala.

### Worker / Pipeline

Fluxo atual:

1. Recebe job BullMQ.
2. Valida payload.
3. Resolve vídeo original por upload ou YouTube.
4. Extrai áudio com FFmpeg.
5. Tenta transcrição por captions/ASR remoto/API.
6. Salva transcrição com métricas de qualidade.
7. Executa análise LLM Pass 1/Pass 2.
8. Valida cortes com heurísticas de texto e boundaries.
9. Salva clips.
10. Renderiza clips.
11. Atualiza status e quota.

Pontos fortes:

- Retry/backoff.
- DLQ.
- Healthcheck.
- Concurrency configurável.
- ASR remoto opcional.
- Fallback operacional se IA falhar.
- Render local/remoto/Remotion opcional.

Lacunas:

- Falta idempotência forte em todos os jobs.
- Falta tracing distribuído.
- Falta métricas Prometheus/OpenTelemetry.
- Falta processamento cloud escalável com workers horizontais prontos para produção.
- Falta dataset de avaliação com ground truth humano.

### IA / Clip Analyzer

Pontos fortes:

- Pass 1 para candidatos.
- Pass 2 para curadoria.
- Zod schemas.
- JSON parsing resiliente.
- Telemetria de tokens/modelos.
- Fallback offline/operacional.
- Validação semântica e score composicional.

Lacunas:

- Score ainda depende majoritariamente de texto.
- Falta áudio: energia vocal, risada, silêncio, velocidade, pitch.
- Falta vídeo: expressões faciais, troca de cena, movimento, objeto, active speaker.
- Falta benchmark contra humanos.
- Falta feedback loop com dados reais de performance social.

### Render / Vídeo

Pontos fortes:

- FFmpeg robusto para render básico.
- Remotion opcional para render mais rico.
- SRT/VTT/ASS.
- Word timestamps quando disponíveis.
- Temas de caption.
- Thumbnail.
- Layouts variados no schema.

Lacunas:

- Face tracking atual é heurístico por speaker/transcrição, não visão computacional real.
- Falta active speaker detection.
- Falta smart crop suave real.
- Falta B-roll automático.
- Falta filler removal renderizado como edição real.
- Falta speech enhancement competitivo.
- Falta export avançado/XML/EDL para Premiere/DaVinci.

### Publicação / Distribuição

Pontos fortes:

- Modelo `SocialAccount`.
- Modelo `PublishedClip`.
- OAuth YouTube.
- Publicação YouTube.
- Scheduler de publicações pendentes.

Lacunas:

- Falta TikTok.
- Falta Instagram Reels.
- Falta Facebook.
- Falta LinkedIn.
- Falta X/Twitter.
- Falta calendário visual.
- Falta bulk scheduler.
- Falta metadados por plataforma.
- Falta analytics pós-publicação.

### Segurança

Base boa para MVP:

- bcrypt com cost 12.
- JWT obrigatório.
- CORS allowlist.
- ValidationPipe com whitelist e forbidNonWhitelisted.
- Upload com limite e magic bytes.
- Path safety em download.
- AES-256-GCM para secrets.
- Rate limiting global.
- Proteção básica contra brute force em memória.

Para competir com Opus/Vizard enterprise, ainda falta:

- SOC 2 readiness.
- SSO/SAML.
- MFA.
- Audit logs.
- RBAC.
- Token em httpOnly cookie.
- Refresh token rotation.
- Secret rotation.
- Security headers completos.
- Política de retenção/deleção de dados.
- Pentest/checklist OWASP formal.

## O Que Falta Para Chegar Em Primeiro

### 1. Multimodal real

Hoje o CLIPIA escolhe cortes principalmente por transcrição/LLM. Para bater Opus, precisa pontuar também:

- Áudio.
- Expressão facial.
- Cortes de cena.
- Objetos visuais.
- Energia vocal.
- Silêncio/pausa.
- Movimento de câmera.
- Active speaker.

### 2. Face tracking verdadeiro

O `FaceDetectionService` atual é heurístico por speaker. Precisa de visão computacional real:

- MediaPipe/YOLO/RetinaFace.
- Active speaker detection.
- Crop 9:16 suave.
- Dead-zone para evitar tremedeira.
- Layouts automáticos para podcast/screen share/gameplay.

### 3. Publicação multicanal

YouTube existe, mas primeiro lugar exige:

- TikTok.
- Instagram Reels.
- LinkedIn.
- Facebook.
- X.
- Calendário visual.
- Bulk scheduler.
- Metadata por plataforma.
- Status pós-publicação.

### 4. Editor por texto

Precisa editar vídeo como documento:

- Apagar palavra/frase.
- Ajustar cortes pela transcrição.
- Undo/redo.
- Preview sincronizado.
- Timeline.
- Split/merge clips.
- Batch render.

### 5. B-roll e assets automáticos

Opus oferece AI/stock B-roll. CLIPIA precisa:

- Detectar entidades/conceitos.
- Buscar stock ou gerar asset.
- Aplicar overlay com timing.
- Permitir revisão humana.
- Salvar asset library por brand.

### 6. SaaS enterprise

Para competir no topo:

- Storage cloud.
- CDN.
- Signed URLs.
- Observabilidade.
- Métricas.
- Audit logs.
- SSO/SAML.
- MFA.
- RBAC.
- Workspace/team.
- Permissões.
- SOC 2 readiness.

### 7. Billing real e produto fechado

Backend Stripe existe, mas precisa experiência completa:

- Checkout completo.
- Portal do cliente.
- Limites claros.
- Créditos por minuto.
- Histórico de uso.
- Upgrade/downgrade sem fricção.
- Bloqueio por quota confiável.

### 8. API pública/documentação

Vizard já usa API como vantagem. CLIPIA deveria expor API documentada para agências:

- Submit video.
- Poll status.
- Retrieve clips.
- Render clip.
- Publish.
- Webhooks.
- API keys por workspace.

## Plano Para Virar #1

| Fase | Entrega | Impacto |
|---|---|---|
| 1 | Fechar produto SaaS: billing real, storage cloud, signed URLs, deploy cloud, logs/métricas | Sobe escalabilidade e confiança |
| 2 | Publicação TikTok/Instagram/LinkedIn/X + calendário + bulk scheduler | Ataca maior gap contra Opus/Vizard |
| 3 | Editor por texto + timeline + batch operations | Melhora UX e retenção |
| 4 | Face tracking real + active speaker + smart crop suave | Fecha gap visual crítico |
| 5 | Scoring multimodal: texto + áudio + vídeo + emoção | Diferencia IA, melhora qualidade dos cortes |
| 6 | B-roll/auto hook/filler removal/speech enhancement | Igualar pacote premium Opus |
| 7 | API pública + webhooks + workspaces + RBAC | Vender para agências e B2B |
| 8 | Segurança enterprise: MFA, SSO, audit log, SOC 2 readiness | Chegar no padrão dos líderes |

## Roadmap Técnico Recomendado

### Fase 1 — Produto SaaS mínimo vendável

Prioridade: alta.

Entregas:

- Storage S3/R2 com signed URLs.
- Remover dependência de paths locais no produto final.
- Billing funcional no frontend.
- Página de uso/créditos.
- Checkout e portal Stripe.
- Planos e quotas por minuto/render.
- Deploy cloud com workers separados.
- Logs estruturados e métricas.
- Alertas básicos para falhas de worker/render.

Critério de aceite:

- Usuário consegue criar conta, pagar, processar vídeo, renderizar, baixar e ver quota sem intervenção manual.

### Fase 2 — Distribuição social

Prioridade: alta.

Entregas:

- TikTok Content Posting API.
- Instagram Graph API/Reels.
- LinkedIn video publishing.
- X/Facebook se fizer sentido comercial.
- Scheduler visual.
- Bulk publish.
- Geração de título, descrição e hashtags por plataforma.
- Estado por publicação: pending, publishing, published, failed, scheduled.

Critério de aceite:

- Usuário processa um vídeo longo e agenda múltiplos clips em pelo menos YouTube, TikTok e Instagram.

### Fase 3 — Editor profissional

Prioridade: alta.

Entregas:

- Transcrição clicável.
- Ajuste de start/end por palavra.
- Remoção de palavras/frases.
- Undo/redo.
- Preview sincronizado.
- Timeline simples.
- Split/merge.
- Batch render.

Critério de aceite:

- Usuário consegue corrigir um clip sem sair do CLIPIA e sem usar CapCut/Premiere para ajustes simples.

### Fase 4 — Visão computacional

Prioridade: alta.

Entregas:

- Detecção real de face/corpo.
- Tracking por frame amostrado.
- Active speaker detection.
- Smooth crop.
- Layout podcast split automático.
- Layout screen + face para aulas/tutorials.

Critério de aceite:

- Em vídeo podcast com duas pessoas, crop segue o speaker correto com movimentos suaves e sem cortes estranhos.

### Fase 5 — Scoring multimodal

Prioridade: média/alta.

Entregas:

- Audio energy score.
- Speech pace.
- Pitch/volume spikes.
- Silence/filler detection.
- Expression score.
- Scene change score.
- Score final treinado/calibrado com feedback humano.

Critério de aceite:

- Ranking de clips melhora contra baseline textual em dataset interno avaliado por humanos.

### Fase 6 — Diferenciais premium

Prioridade: média.

Entregas:

- B-roll automático.
- Auto hook.
- Filler/pause removal.
- Speech enhancement.
- Auto emojis controláveis.
- Intro/outro cards.
- Asset library.
- Export XML/EDL.

Critério de aceite:

- CLIPIA gera um clip publicável sem edição externa em 80% dos casos de podcast/aula/interview.

### Fase 7 — Enterprise/API

Prioridade: média.

Entregas:

- API pública versionada.
- Webhooks.
- Workspaces.
- Roles/permissões.
- API keys por workspace.
- Audit log.
- SSO/SAML.
- MFA.
- Retenção configurável.

Critério de aceite:

- Agência consegue integrar CLIPIA no próprio pipeline sem usar UI.

## Posicionamento Estratégico Recomendado

O caminho mais realista não é tentar bater Opus global imediatamente. O melhor posicionamento é:

**“O melhor Opus Clip para criadores, podcasts e agências em português do Brasil, com preço local, controle de custo e workflow de publicação.”**

Diferenciais que o CLIPIA pode explorar:

- PT-BR nativo.
- Preço em reais.
- BYOK para IA.
- Suporte local.
- Templates para podcast brasileiro.
- Heurísticas para linguagem falada brasileira.
- Integração com YouTube/Instagram/TikTok com foco em criador BR.
- Planos de agência sem surpresa por crédito/minuto.

## Veredito Final

O CLIPIA não está em primeiro hoje. Está em quarto no ranking geral, mas com uma base técnica melhor do que muitos MVPs do mercado.

A maior oportunidade é posicionamento: vencer primeiro no Brasil/PT-BR com preço em reais, qualidade superior para português, controle de custo BYOK e workflow de agência.

Para bater Opus globalmente, o caminho crítico é:

1. Multimodal real.
2. Publicação multicanal.
3. Editor profissional.
4. Maturidade SaaS/enterprise.
5. Segurança e compliance em nível corporativo.

#################

# Planejamento Detalhado Para Levar o CLIPIA ao Topo

Objetivo: transformar o CLIPIA de um MVP técnico avançado em uma plataforma SaaS competitiva contra Opus Clip, Vizard e Klap, com foco inicial em liderança no mercado PT-BR e evolução posterior para competição global.

Critério de sucesso final:

- O usuário envia um vídeo longo.
- A plataforma encontra os melhores momentos com alta precisão.
- Os clips saem visualmente prontos para publicação.
- O usuário consegue editar, revisar, agendar e publicar em múltiplas redes sem sair do CLIPIA.
- O sistema opera como SaaS escalável, seguro, monetizável e confiável.

## Fase 0 — Consolidação Antes de Escalar

Prioridade: crítica.  
Objetivo: garantir que a base atual está estável antes de adicionar recursos grandes.

### Checklist Técnico

- [ ] Revisar todos os fluxos existentes: upload, YouTube URL, transcrição, análise, render, download, publicação YouTube.
- [ ] Criar testes E2E mínimos para o fluxo completo com vídeo pequeno.
- [ ] Criar dataset interno com 10 a 20 vídeos reais em PT-BR.
- [ ] Criar planilha de avaliação humana dos clips gerados.
- [ ] Medir tempo médio por etapa: download, áudio, ASR, IA, render, upload/download.
- [ ] Medir custo médio por minuto processado.
- [ ] Registrar taxa de falha por etapa.
- [ ] Definir baseline de qualidade atual para comparar melhorias futuras.
- [ ] Revisar todos os endpoints sem paginação.
- [ ] Revisar todos os fluxos que dependem de path local.
- [ ] Revisar telas que ainda pareçam mockadas ou incompletas.

### Critério de Aceite

- Existe um relatório objetivo com tempo, custo, taxa de erro e qualidade dos clips atuais.
- O time consegue saber se uma mudança futura melhorou ou piorou o produto.

## Fase 1 — SaaS Vendável e Operacional

Prioridade: crítica.  
Objetivo: deixar o produto pronto para operar com clientes reais, cobrança e armazenamento confiável.

### Storage e Arquivos

- [ ] Criar abstração final de storage local/cloud.
- [ ] Implementar Cloudflare R2, AWS S3 ou storage compatível.
- [ ] Migrar uploads originais para storage cloud.
- [ ] Migrar clips renderizados para storage cloud.
- [ ] Migrar thumbnails, SRT, VTT e ASS para storage cloud.
- [ ] Implementar signed URLs com expiração.
- [ ] Implementar política de retenção de arquivos.
- [ ] Implementar limpeza de arquivos órfãos.
- [ ] Implementar exclusão real de arquivos ao deletar projeto.
- [ ] Implementar CDN para entrega de vídeos.

### Billing e Quotas

- [ ] Finalizar checkout Stripe no frontend.
- [ ] Finalizar portal Stripe no frontend.
- [ ] Exibir plano atual do usuário.
- [ ] Exibir uso de minutos do mês.
- [ ] Exibir uso de renders do mês.
- [ ] Exibir limite por plano.
- [ ] Bloquear processamento quando quota acabar.
- [ ] Bloquear render quando quota acabar.
- [ ] Criar histórico de uso por projeto.
- [ ] Criar histórico de faturas ou link para portal.
- [ ] Criar upgrade/downgrade funcional.
- [ ] Definir planos comerciais reais.

### Observabilidade

- [ ] Padronizar logs estruturados.
- [ ] Adicionar correlation ID por projeto/job.
- [ ] Adicionar métricas de jobs processados.
- [ ] Adicionar métricas de jobs falhos.
- [ ] Adicionar métricas de tempo por etapa.
- [ ] Adicionar alertas para falhas recorrentes.
- [ ] Adicionar dashboard operacional.
- [ ] Adicionar rastreamento de custos por provider de IA.

### Deploy

- [ ] Criar Dockerfiles finais para web, API e worker.
- [ ] Configurar ambiente staging.
- [ ] Configurar ambiente produção.
- [ ] Configurar migrations seguras.
- [ ] Configurar rollback.
- [ ] Configurar healthchecks.
- [ ] Configurar restart policy dos workers.
- [ ] Configurar secrets fora do repositório.
- [ ] Configurar CI com typecheck, testes e build.

### Critério de Aceite

- Um cliente consegue pagar, processar vídeo, renderizar clips, baixar resultados e consultar quota sem intervenção manual.
- Um erro de worker fica visível em logs/métricas.
- Arquivos não dependem mais de disco local para operação SaaS.

## Fase 2 — Publicação Multicanal e Calendário

Prioridade: crítica.  
Objetivo: transformar o CLIPIA de ferramenta de corte em plataforma de distribuição.

### Integrações Sociais

- [ ] Finalizar publicação YouTube Shorts com metadados configuráveis.
- [ ] Implementar TikTok Content Posting API.
- [ ] Implementar Instagram Graph API para Reels.
- [ ] Implementar Facebook Reels, se fizer sentido para o público.
- [ ] Implementar LinkedIn video publishing.
- [ ] Avaliar X/Twitter video publishing.
- [ ] Criar modelo de conta social por plataforma.
- [ ] Criar renovação automática de tokens.
- [ ] Criar tela de contas conectadas.
- [ ] Criar tela para desconectar contas.
- [ ] Criar status de saúde da conexão.

### Agendamento

- [ ] Criar calendário visual.
- [ ] Criar agendamento por clip.
- [ ] Criar agendamento em lote.
- [ ] Criar regras de distribuição por score.
- [ ] Criar sugestão automática de horários.
- [ ] Criar fila de publicações futuras.
- [ ] Criar retry de publicação.
- [ ] Criar cancelamento de publicação agendada.
- [ ] Criar edição de metadados antes da publicação.
- [ ] Criar histórico de publicações.

### Metadados por Plataforma

- [ ] Gerar título por clip.
- [ ] Gerar descrição por clip.
- [ ] Gerar hashtags por plataforma.
- [ ] Gerar CTA por plataforma.
- [ ] Gerar variações de copy.
- [ ] Permitir edição manual antes de postar.
- [ ] Salvar presets por marca.
- [ ] Adaptar limite de caracteres por plataforma.

### Critério de Aceite

- O usuário consegue selecionar 10 clips e agendar publicações em YouTube, TikTok e Instagram.
- Cada plataforma recebe título, descrição e hashtags adequados.
- O usuário vê status claro de publicado, agendado, falhou ou pendente.

## Fase 3 — Editor Profissional Por Texto

Prioridade: alta.  
Objetivo: reduzir dependência de CapCut, Premiere ou edição externa.

### Transcrição Interativa

- [ ] Mostrar transcrição completa do clip.
- [ ] Mostrar palavras com timestamp.
- [ ] Permitir clicar em palavra para mover cursor do preview.
- [ ] Permitir selecionar trecho por texto.
- [ ] Permitir ajustar início/fim arrastando na transcrição.
- [ ] Permitir remover palavra ou frase.
- [ ] Permitir restaurar palavra ou frase removida.
- [ ] Destacar palavras com baixa confiança.
- [ ] Permitir correção manual de texto da legenda.
- [ ] Salvar versão editada sem perder transcrição original.

### Timeline e Preview

- [ ] Criar preview sincronizado.
- [ ] Criar timeline simples do clip.
- [ ] Permitir zoom na timeline.
- [ ] Permitir split do clip.
- [ ] Permitir merge de trechos.
- [ ] Permitir ajuste fino por frame ou por décimo de segundo.
- [ ] Mostrar waveform de áudio.
- [ ] Mostrar markers de hook, pico emocional e fechamento.
- [ ] Criar preview rápido em baixa qualidade.
- [ ] Criar render final em alta qualidade.

### Undo/Redo e Versionamento

- [ ] Implementar undo.
- [ ] Implementar redo.
- [ ] Criar autosave.
- [ ] Criar histórico de versões por clip.
- [ ] Permitir duplicar clip para testar variações.
- [ ] Permitir comparar versão A/B.

### Operações em Lote

- [ ] Aplicar tema em múltiplos clips.
- [ ] Aplicar layout em múltiplos clips.
- [ ] Renderizar múltiplos clips.
- [ ] Baixar múltiplos clips.
- [ ] Publicar múltiplos clips.
- [ ] Excluir múltiplos clips.

### Critério de Aceite

- O usuário consegue corrigir texto, cortar frase ruim, ajustar timing, re-renderizar e publicar sem sair do CLIPIA.
- Edições simples não exigem ferramenta externa.

## Fase 4 — Face Tracking Real e Smart Reframe

Prioridade: alta.  
Objetivo: competir visualmente com Opus Clip e Vizard.

### Detecção Visual

- [ ] Escolher biblioteca/modelo de detecção: MediaPipe, YOLO, RetinaFace ou alternativa.
- [ ] Criar serviço real de detecção facial.
- [ ] Amostrar frames em intervalo configurável.
- [ ] Detectar múltiplos rostos.
- [ ] Salvar caixas de face por timestamp.
- [ ] Salvar confiança da detecção.
- [ ] Ignorar detecções instáveis.
- [ ] Criar fallback quando nenhuma face for encontrada.

### Active Speaker Detection

- [ ] Avaliar diarização de áudio.
- [ ] Mapear speaker da transcrição para face provável.
- [ ] Detectar movimento labial quando possível.
- [ ] Correlacionar fala com rosto ativo.
- [ ] Criar timeline de speaker ativo.
- [ ] Medir precisão em podcasts com 2 pessoas.
- [ ] Criar fallback para split screen quando speaker for incerto.

### Smart Crop

- [ ] Criar algoritmo de crop 9:16 baseado em face.
- [ ] Implementar smoothing.
- [ ] Implementar dead-zone.
- [ ] Evitar movimentos bruscos.
- [ ] Evitar cortar testa/queixo.
- [ ] Adaptar crop para tela 16:9, 4:3 e vertical.
- [ ] Criar crop para pessoa em pé, sentado, aula e podcast.
- [ ] Renderizar com Remotion ou FFmpeg de forma consistente.

### Layouts Inteligentes

- [ ] Layout speaker close-up.
- [ ] Layout podcast split.
- [ ] Layout screen plus face.
- [ ] Layout slide plus presenter.
- [ ] Layout gameplay plus facecam.
- [ ] Layout multi-speaker automático.
- [ ] Troca dinâmica de layout durante o clip.

### Critério de Aceite

- Em vídeo com duas pessoas, o crop acompanha quem fala.
- O movimento de câmera artificial é suave.
- O resultado final parece intencional, não apenas crop central.

## Fase 5 — Scoring Multimodal Real

Prioridade: alta.  
Objetivo: melhorar a qualidade dos clips escolhidos e reduzir revisão manual.

### Áudio

- [ ] Extrair energia vocal por segmento.
- [ ] Extrair volume médio e variação.
- [ ] Extrair velocidade de fala.
- [ ] Detectar silêncio.
- [ ] Detectar risada.
- [ ] Detectar aplauso ou reação.
- [ ] Detectar interrupção ou sobreposição de fala.
- [ ] Criar `audioEnergyScore`.
- [ ] Incluir áudio no score final.

### Vídeo

- [ ] Detectar expressões faciais.
- [ ] Detectar sorriso, surpresa, raiva ou emoção alta.
- [ ] Detectar mudança de cena.
- [ ] Detectar movimento visual.
- [ ] Detectar presença de texto na tela.
- [ ] Detectar objetos relevantes.
- [ ] Criar `visualInterestScore`.
- [ ] Incluir vídeo no score final.

### Texto e Narrativa

- [ ] Melhorar detecção de hook.
- [ ] Melhorar detecção de fechamento.
- [ ] Detectar frase incompleta.
- [ ] Detectar falta de contexto.
- [ ] Detectar excesso de contexto.
- [ ] Detectar pergunta/resposta forte.
- [ ] Detectar opinião polêmica.
- [ ] Detectar frase compartilhável.
- [ ] Detectar insight educacional.

### Score Final

- [ ] Criar score composto texto + áudio + vídeo.
- [ ] Calibrar pesos por tipo de conteúdo: podcast, aula, live, entrevista, vendas.
- [ ] Criar explicação legível do score.
- [ ] Registrar breakdown no banco.
- [ ] Comparar score contra avaliação humana.
- [ ] Criar loop de feedback com thumbs down/reason.
- [ ] Criar dataset de clips bons/ruins.

### Critério de Aceite

- O ranking dos clips melhora de forma mensurável contra o baseline textual.
- Clips com energia emocional real sobem no ranking.
- Clips tecnicamente fracos descem no ranking mesmo com texto razoável.

## Fase 6 — B-roll, Auto Hook e Polimento Visual Premium

Prioridade: média/alta.  
Objetivo: fazer os clips parecerem finalizados, não apenas recortados e legendados.

### B-roll Automático

- [ ] Detectar entidades e conceitos por trecho.
- [ ] Buscar assets de stock.
- [ ] Avaliar geração de imagem/vídeo por IA.
- [ ] Criar biblioteca de assets por projeto.
- [ ] Inserir B-roll em pontos de baixa variação visual.
- [ ] Limitar B-roll para não poluir o clip.
- [ ] Permitir aprovar/reprovar B-roll antes do render.
- [ ] Salvar origem/licença do asset.

### Auto Hook

- [ ] Detectar se os primeiros 3 segundos são fracos.
- [ ] Encontrar frase mais forte do clip.
- [ ] Criar teaser no início.
- [ ] Criar overlay de hook.
- [ ] Permitir escolher entre clip original e versão com auto hook.
- [ ] Medir impacto em taxa de retenção quando houver analytics.

### Filler Removal

- [ ] Detectar vícios de linguagem.
- [ ] Detectar pausas longas.
- [ ] Permitir remoção automática conservadora.
- [ ] Mostrar lista de cortes sugeridos.
- [ ] Renderizar áudio/vídeo sem jumps ruins.
- [ ] Permitir restaurar trechos removidos.

### Speech Enhancement

- [ ] Normalizar loudness.
- [ ] Reduzir ruído.
- [ ] Melhorar clareza da voz.
- [ ] Controlar música de fundo.
- [ ] Evitar distorção em vozes altas.
- [ ] Criar opção por projeto: natural, podcast, agressivo.

### Templates Premium

- [ ] Criar presets visuais por nicho.
- [ ] Criar temas para podcast.
- [ ] Criar temas para cortes de aula.
- [ ] Criar temas para vendas.
- [ ] Criar temas para cortes motivacionais.
- [ ] Criar temas para cortes polêmicos.
- [ ] Criar preview animado de cada tema.

### Critério de Aceite

- Um clip gerado pelo CLIPIA parece pronto para publicação sem abrir outro editor.
- O usuário consegue escolher entre versão simples e versão premium enriquecida.

## Fase 7 — Brand Kit e Fluxo de Agência

Prioridade: média/alta.  
Objetivo: tornar o CLIPIA atrativo para creators profissionais e agências.

### Brand Kit

- [ ] Finalizar persistência completa do brand kit.
- [ ] Upload de logo.
- [ ] Upload de watermark.
- [ ] Paleta de cores.
- [ ] Fontes customizadas.
- [ ] Presets de legenda.
- [ ] Presets de layout.
- [ ] Intro/outro.
- [ ] Templates por marca.
- [ ] Aplicação automática do brand kit em novos projetos.

### Workspaces

- [ ] Criar workspace.
- [ ] Convidar membros.
- [ ] Definir roles: owner, admin, editor, viewer.
- [ ] Separar projetos por workspace.
- [ ] Separar contas sociais por workspace.
- [ ] Separar billing por workspace.
- [ ] Criar permissões por ação.

### Aprovação e Revisão

- [ ] Criar status de clip: draft, needs review, approved, scheduled, published.
- [ ] Permitir comentário por clip.
- [ ] Permitir solicitar alteração.
- [ ] Criar link de revisão externo.
- [ ] Criar aprovação antes de publicar.
- [ ] Criar histórico de alterações.

### Critério de Aceite

- Uma agência consegue operar múltiplos clientes com marcas, contas sociais e aprovações separadas.

## Fase 8 — API Pública, Webhooks e Integrações

Prioridade: média.  
Objetivo: competir com Vizard em automação e B2B.

### API Pública

- [ ] Criar API keys por usuário/workspace.
- [ ] Criar rate limits por API key.
- [ ] Criar endpoint para upload.
- [ ] Criar endpoint para enviar URL.
- [ ] Criar endpoint para consultar status.
- [ ] Criar endpoint para listar clips.
- [ ] Criar endpoint para renderizar clip.
- [ ] Criar endpoint para baixar clip.
- [ ] Criar endpoint para publicar clip.
- [ ] Versionar API como `/v1`.

### Documentação

- [ ] Criar documentação OpenAPI.
- [ ] Criar exemplos cURL.
- [ ] Criar exemplos Node.js.
- [ ] Criar exemplos Python.
- [ ] Criar página de erros e códigos.
- [ ] Criar guia de autenticação.
- [ ] Criar guia de webhooks.

### Webhooks

- [ ] Webhook de projeto processado.
- [ ] Webhook de projeto falhou.
- [ ] Webhook de clip renderizado.
- [ ] Webhook de publicação concluída.
- [ ] Webhook de publicação falhou.
- [ ] Assinatura HMAC em webhooks.
- [ ] Retry de webhooks.
- [ ] Logs de entrega.

### Critério de Aceite

- Um cliente B2B consegue integrar o CLIPIA sem usar a interface web.
- A integração consegue enviar vídeo, esperar processamento e receber clips automaticamente.

## Fase 9 — Segurança Enterprise e Compliance

Prioridade: média/alta para B2B.  
Objetivo: reduzir risco e habilitar vendas maiores.

### Autenticação e Sessão

- [ ] Migrar access token para memória ou cookie seguro.
- [ ] Implementar refresh token httpOnly.
- [ ] Implementar rotação de refresh token.
- [ ] Implementar logout server-side.
- [ ] Implementar MFA.
- [ ] Implementar recuperação de senha.
- [ ] Implementar verificação de e-mail.
- [ ] Implementar sessões ativas.
- [ ] Permitir revogar sessão.

### Enterprise

- [ ] Implementar SSO/SAML.
- [ ] Implementar SCIM, se necessário.
- [ ] Implementar RBAC.
- [ ] Implementar audit log.
- [ ] Implementar export de audit log.
- [ ] Implementar política de retenção por workspace.
- [ ] Implementar DPA e termos de processamento de dados.

### Segurança Aplicacional

- [ ] Revisar OWASP Top 10.
- [ ] Adicionar security headers.
- [ ] Revisar CSRF conforme estratégia de cookies.
- [ ] Revisar XSS em campos ricos.
- [ ] Revisar SSRF em fluxos de URL externa.
- [ ] Revisar upload malware/content validation.
- [ ] Revisar prompt injection.
- [ ] Revisar vazamento de secrets em logs.
- [ ] Implementar secret rotation.
- [ ] Implementar pentest antes de escalar B2B.

### Compliance

- [ ] Criar política de privacidade compatível com operação.
- [ ] Criar termos de uso.
- [ ] Criar subprocessadores.
- [ ] Criar data retention policy.
- [ ] Criar processo de deleção de dados.
- [ ] Preparar controles SOC 2.
- [ ] Documentar backups.
- [ ] Documentar incident response.

### Critério de Aceite

- O CLIPIA consegue passar por uma due diligence básica de cliente B2B.
- Há trilha de auditoria para ações relevantes.
- Há controles documentados para dados, acesso, retenção e incidentes.

## Fase 10 — Analytics Pós-Publicação e Feedback Loop

Prioridade: média.  
Objetivo: transformar performance real em melhoria da IA.

### Coleta de Métricas

- [ ] Coletar views por plataforma.
- [ ] Coletar likes.
- [ ] Coletar comentários.
- [ ] Coletar compartilhamentos.
- [ ] Coletar retenção quando disponível.
- [ ] Coletar watch time quando disponível.
- [ ] Coletar CTR quando disponível.
- [ ] Normalizar métricas entre plataformas.

### Dashboard

- [ ] Criar ranking de clips publicados.
- [ ] Mostrar performance por projeto.
- [ ] Mostrar performance por tema de legenda.
- [ ] Mostrar performance por layout.
- [ ] Mostrar performance por tipo de hook.
- [ ] Mostrar melhor horário de postagem.
- [ ] Mostrar recomendações automáticas.

### Feedback Para IA

- [ ] Relacionar score previsto com performance real.
- [ ] Detectar padrões de clips que performam acima do esperado.
- [ ] Detectar padrões de clips que performam abaixo do esperado.
- [ ] Ajustar prompts e pesos de score.
- [ ] Criar dataset de treino/avaliação.
- [ ] Criar modelo interno de previsão quando houver dados suficientes.

### Critério de Aceite

- A plataforma aprende com performance real.
- O score deixa de ser apenas teórico e passa a refletir resultados observados.

## Ordem Recomendada de Execução

1. Fase 0 — Medição e baseline.
2. Fase 1 — SaaS vendável.
3. Fase 2 — Publicação multicanal.
4. Fase 3 — Editor por texto.
5. Fase 4 — Face tracking real.
6. Fase 5 — Scoring multimodal.
7. Fase 6 — B-roll e polimento premium.
8. Fase 7 — Brand kit e agências.
9. Fase 8 — API pública.
10. Fase 9 — Segurança enterprise.
11. Fase 10 — Analytics e feedback loop.

## Metas Por Marco

### Marco 1 — Produto Vendável

- Fases incluídas: 0 e 1.
- Resultado: SaaS funcional com billing, storage cloud, deploy e monitoramento.
- Nota esperada do CLIPIA: 7.8/10.

### Marco 2 — Produto Competitivo Para Creators

- Fases incluídas: 2 e 3.
- Resultado: publicação multicanal e editor útil o bastante para reduzir ferramentas externas.
- Nota esperada do CLIPIA: 8.3/10.

### Marco 3 — Produto Visualmente Competitivo

- Fases incluídas: 4 e 6.
- Resultado: clips com smart reframe real, templates e B-roll.
- Nota esperada do CLIPIA: 8.7/10.

### Marco 4 — Produto Superior em PT-BR

- Fases incluídas: 5 e 10.
- Resultado: score calibrado com áudio, vídeo, texto e performance real.
- Nota esperada do CLIPIA: 9.0/10 no mercado brasileiro.

### Marco 5 — Produto B2B/Enterprise

- Fases incluídas: 7, 8 e 9.
- Resultado: workspaces, API, webhooks, segurança enterprise e operação para agências.
- Nota esperada do CLIPIA: 9.2/10 globalmente.

## Principais Riscos do Plano

- Integrações sociais podem atrasar por revisão de apps e políticas de plataforma.
- Face tracking real pode exigir otimização pesada de custo/latência.
- B-roll automático pode gerar resultado poluído se não houver controle editorial.
- Billing e quotas precisam ser muito confiáveis para evitar prejuízo por uso excessivo.
- API pública aumenta superfície de abuso e exige rate limit forte.
- Enterprise exige disciplina de segurança e processos, não só código.

## Decisão Estratégica Recomendada

O caminho mais eficiente é não tentar copiar tudo do Opus de uma vez.

Sequência pragmática:

1. Fechar SaaS vendável.
2. Resolver distribuição multicanal.
3. Criar editor por texto.
4. Melhorar visual com face tracking.
5. Só então investir pesado em B-roll e multimodal avançado.

Justificativa:

- Publicação e workflow aumentam retenção mais rápido que recursos experimentais.
- Editor reduz churn porque dá controle ao usuário.
- Face tracking melhora percepção visual imediatamente.
- Multimodal e B-roll são poderosos, mas custam mais para acertar com qualidade.

## Definição de Primeiro Lugar Para o CLIPIA

O CLIPIA chega em primeiro no mercado-alvo quando cumprir estes pontos:

- Melhor qualidade de clips em português do Brasil.
- Menor tempo entre upload e clip publicado.
- Publicação em YouTube, TikTok e Instagram sem ferramenta externa.
- Editor simples o suficiente para creator e forte o suficiente para agência.
- Preço em reais competitivo.
- Operação confiável em produção.
- Segurança suficiente para clientes profissionais.
- Feedback loop usando performance real dos posts.

O primeiro lugar global exige mais:

- Multimodal no nível do Opus.
- B-roll e templates premium no nível dos líderes.
- API e automação no nível do Vizard.
- Segurança/compliance no nível enterprise.
- Marca e UX com acabamento de produto internacional.
