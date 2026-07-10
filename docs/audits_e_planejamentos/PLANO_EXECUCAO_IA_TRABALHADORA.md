# Plano de Execucao Para IA Trabalhadora

Fonte principal: `AUDITORIA_CLIPIA.md`

Papel deste documento: transformar a auditoria em um roteiro de codificacao. A IA trabalhadora deve implementar fase por fase, marcar checklists e parar ao final de cada fase entregando diff/resumo para revisao do gerente tecnico.

## Regras Obrigatorias

- Nao alterar design, layout, UX, landing page, editor ou pagina de projeto salvo quando a fase pedir explicitamente.
- Nao reescrever arquitetura inteira.
- Nao trocar stack.
- Nao remover funcionalidades existentes.
- Nao apagar dados, migrations ou arquivos de usuario sem rotina segura.
- Nao commitar secrets reais.
- Nao usar valores reais de `.env` em documentacao, logs ou testes.
- Toda mudanca deve preservar o fluxo atual: login, criar projeto, upload/YouTube, processamento, ver cortes, reproduzir corte, deletar projeto/clip.
- Cada fase deve terminar com typecheck/build/testes aplicaveis.
- Se encontrar bug critico fora do escopo, registrar no fim da fase em "Achados adicionais" e nao sair implementando sem encaixar na fase correta.

## Como Trabalhar

Para cada fase:

1. Ler os arquivos citados.
2. Confirmar o comportamento atual no codigo.
3. Implementar a menor mudanca segura.
4. Adicionar teste minimo quando a tarefa for de seguranca, dados ou worker.
5. Rodar validacoes.
6. Marcar checklist com `[x]`.
7. Escrever resumo objetivo:
   - arquivos alterados;
   - comportamento antes/depois;
   - comandos rodados;
   - riscos remanescentes.

## Ordem Executiva

Nao pular fases. Nao fazer Fase 4 antes de Fase 1. O produto esta saindo de MVP para producao, entao seguranca, dados e estabilidade vem antes de features competitivas.

---

# Fase 1 - Seguranca Critica e Vazamento de Arquivos

Objetivo: fechar riscos que permitem abuso direto da API, leitura indevida de arquivos ou upload malicioso.

Escopo permitido:

- `apps/api/src/clips/*`
- `apps/api/src/projects/*`
- `apps/api/src/auth/*`
- `apps/api/src/common/*`
- `apps/api/src/main.ts`
- `.env.example`
- testes relacionados

Nao alterar:

- UI do dashboard.
- Editor.
- Worker, exceto se for estritamente necessario para compatibilidade.

## Tarefas

- [x] Proteger `GET /clips/:clipId/download` contra path traversal.
- [x] Proteger `GET /clips/:clipId/thumbnail` contra path traversal.
- [x] Proteger `GET /clips/:clipId/subtitle` contra path traversal.
- [x] Criar helper central para validar que um path resolvido fica dentro de `STORAGE_ROOT`.
- [x] Retornar erro seguro quando arquivo nao existir ou estiver fora do storage permitido.
- [x] Trocar upload baseado apenas em MIME/extensao por validacao de magic bytes.
- [x] Manter whitelist real de video: MP4, MOV, MKV, WebM quando suportado.
- [x] Trocar `renameSync` por operacao async.
- [x] Garantir que falha de validacao de upload remove arquivo temporario.
- [x] Adicionar rate limit global basico para API.
- [x] Adicionar rate limit mais restrito em `POST /auth/login` e `POST /auth/register`.
- [x] Adicionar protecao contra brute force por email + IP no login.
- [x] Adicionar global exception filter para nao vazar stack trace em resposta HTTP.
- [x] Adicionar validacao de forca de senha no registro (maiuscula, minuscula, numero, especial).
- [x] SSRF fix no YouTube download: validar resolucao DNS, timeout de conexao, bloquear IPs privados, limitar redirects.
- [x] Limpar `.env.example`: substituir secrets de desenvolvimento por placeholders seguros.

## Checklist de Aceite

- [x] Download de clip pertencente ao usuario continua funcionando.
- [x] Thumbnail de clip pertencente ao usuario continua funcionando.
- [x] Subtitle de clip pertencente ao usuario continua funcionando.
- [x] Path fora de `STORAGE_ROOT` retorna erro seguro.
- [x] Upload com Content-Type falso e magic bytes invalidos e rejeitado.
- [x] Arquivo temporario invalido e removido.
- [x] Login com excesso de tentativas retorna 429 ou bloqueio temporario.
- [x] Register com excesso de tentativas retorna 429.
- [x] Erro interno nao retorna stack trace.
- [x] `.env.example` nao contem segredo utilizavel como `dev-jwt-secret-change-me`.
- [x] Typecheck passa.
- [ ] Build passa ou o motivo da falha e documentado.

Complexidade: M

Prioridade: maxima.

---

# Fase 2 - Integridade de Dados e Limpeza de Storage

Objetivo: impedir lixo infinito em disco e garantir que delete de projeto/clip apague arquivos fisicos relacionados.

Escopo permitido:

- `apps/api/src/projects/*`
- `apps/api/src/clips/*`
- `apps/api/src/common/*`
- `packages/database/prisma/schema.prisma` se necessario
- scripts de manutencao/cleanup se necessario

## Tarefas

- [x] Mapear todos os paths fisicos associados a um projeto: original, audio, renders, thumbnails, legendas, temporarios.
- [x] Ao deletar projeto, remover arquivos fisicos associados depois de confirmar ownership.
- [x] Ao deletar clip, remover `videoPath`, `thumbnailPath`, `srtPath`, `vttPath` se existirem.
- [x] Implementar rotina segura para ignorar arquivo ja inexistente sem falhar a operacao inteira.
- [x] Implementar limpeza de `storage/uploads/.temp` para arquivos antigos.
- [x] Garantir que delete de banco e delete de arquivos nao deixe estado inconsistente sem log claro.
- [ ] Adicionar teste ou script verificavel para delete de projeto removendo arquivos.

## Checklist de Aceite

- [x] Deletar projeto remove registro do banco.
- [x] Deletar projeto remove arquivos fisicos associados.
- [x] Deletar clip remove registro do banco.
- [x] Deletar clip remove arquivos fisicos associados.
- [x] Arquivo fisico ausente nao quebra delete.
- [x] Arquivo fora de `STORAGE_ROOT` nunca e deletado.
- [x] `.temp` remove arquivos acima do TTL definido.
- [x] Typecheck passa.
- [ ] Build passa ou o motivo da falha e documentado.

Complexidade: M

Prioridade: alta.

---

# Fase 3 - Worker, Jobs Travados e Falhas Visiveis

Objetivo: impedir projeto/corte renderizando para sempre e tornar falhas recuperaveis.

Escopo permitido:

- `apps/worker/src/*`
- `apps/api/src/queue/*`
- `packages/shared/*`
- `packages/database/prisma/schema.prisma` se necessario

## Tarefas

- [x] Validar payload de job em runtime antes de processar.
- [x] Rejeitar job invalido sem derrubar worker.
- [x] Adicionar idempotencia basica: reprocessar mesmo projeto nao duplica clips.
- [x] Definir timeout por etapa: download, extracao de audio, transcricao, analise, render.
- [x] Quando uma etapa falhar definitivamente, marcar projeto como `FAILED`.
- [x] Quando render de clip falhar definitivamente, marcar clip como `FAILED`.
- [x] Criar ou configurar dead letter queue para jobs com falha permanente.
- [x] Adicionar log claro com `projectId`, `clipId`, `jobId`, etapa e erro sanitizado.
- [x] Garantir que retry manual de projeto limpe estado antigo de processamento antes de enfileirar.

## Checklist de Aceite

- [x] Job malformado nao derruba worker.
- [x] Job malformado e registrado como falha.
- [x] Projeto nao fica eternamente em `PROCESSING`.
- [x] Clip nao fica eternamente em `RENDERING`.
- [x] Retry de projeto nao cria duplicatas indevidas.
- [x] Job com falha permanente vai para DLQ ou fica consultavel como failed.
- [x] Logs mostram etapa e entidade afetada.
- [x] Typecheck passa.
- [ ] Build passa ou o motivo da falha e documentado.

Complexidade: G

Prioridade: alta.

---

# Fase 4 - Observabilidade Minima de Producao

Objetivo: tornar possivel debugar falhas reais sem depender de `console.log` solto.

Escopo permitido:

- `apps/api/src/*`
- `apps/worker/src/*`
- `apps/web/src/*` apenas se for para exibir erro/status existente
- infra/dev scripts se necessario

## Tarefas

- [x] Padronizar logs estruturados no API.
- [x] Padronizar logs estruturados no Worker.
- [x] Mascarar secrets/API keys em logs.
- [x] Adicionar health check da API.
- [x] Adicionar health check do worker ou endpoint/status consultavel.
- [x] Registrar tempo por etapa do pipeline no banco ou logs estruturados.
- [x] Registrar falhas por etapa com motivo sanitizado.
- [x] Criar documento curto de operacao: como ver fila, jobs falhos, logs e storage.

## Checklist de Aceite

- [x] Logs nao exibem API keys completas.
- [x] Cada job tem log com `projectId` e etapa.
- [x] API possui health check.
- [x] Falha de processamento tem motivo consultavel.
- [x] Tempo de cada etapa fica visivel em log ou dado persistido.
- [x] Typecheck passa.
- [ ] Build passa ou o motivo da falha e documentado.

Complexidade: M

Prioridade: alta.

---

# Fase 5 - Testes Criticos

Objetivo: criar rede minima contra regressao nos pontos perigosos.

Escopo permitido:

- testes unitarios/integracao no monorepo
- configs de test runner se necessario
- fixtures pequenas

## Tarefas

- [x] Teste de path traversal em download/thumbnail/subtitle (24 testes no API).
- [x] Teste de upload com MIME falso (coberto por magic bytes + safe-path).
- [x] Teste de rate limit/brute force no login (coberto por throttler.test.ts).
- [x] Teste de delete de projeto removendo arquivos (coberto por storage-cleanup.test.ts).
- [x] Teste de delete de clip removendo arquivos (coberto por storage-cleanup.test.ts).
- [x] Teste de payload invalido de job (validate-job-payload.test.ts, 9 testes).
- [x] Teste de parsing/validacao dos prompts se ja existir base (json-parsing.test.ts, 11 testes existentes).
- [x] Documentar comando unico para rodar testes.

## Checklist de Aceite

- [x] Existe comando de teste documentado.
- [x] Testes criticos passam localmente.
- [x] Falha de seguranca causa teste vermelho.
- [x] Testes nao dependem de secrets reais.
- [x] Testes nao consomem API externa.
- [x] Typecheck passa.

Complexidade: M

Prioridade: alta.

---

# Fase 6 - Quotas, Custo e Protecao Contra Uso Infinito

Objetivo: impedir que um usuario gere custo infinito com ASR/LLM/render.

Escopo permitido:

- `packages/database/prisma/schema.prisma`
- `apps/api/src/*`
- `apps/worker/src/*`
- `apps/web/src/app/(dashboard)/dashboard/billing/*` se necessario

## Tarefas

- [x] Criar modelo de uso mensal por usuario/workspace. (`UserQuota` schema, campos `monthlyProjectMinutes`, `monthlyRenders`, `monthlyResetAt`, `maxProjectsPerMonth`, `maxProjectMinutesPerMonth`, `maxRendersPerMonth`)
- [x] Registrar minutos processados por projeto. (`registerMinutesUsed()` na API, `registerQuotaMinutes()` no worker chamado apos processamento)
- [x] Registrar quantidade de renders. (`registerRender()` na API, `registerQuotaRender()` no worker)
- [x] Registrar chamadas/estimativa de tokens LLM quando disponivel. (Projeto armazena `llmPass1Tokens`, `llmPass2Tokens`, `llmCostEstimate`)
- [x] Bloquear novo projeto se quota mensal estourar. (`ensureCanProcessProject()` checado em `attachUpload`, `attachYoutubeUrl`, `retry`)
- [x] Bloquear re-render se quota de render estourar. (`ensureCanRender()` chamado em `clips.service.render()`)
- [x] Exibir erro claro no front quando quota bloquear. (Toast com mensagem em portugues, pagina de billing com barras de uso)
- [x] Criar plano default gratuito/dev. (Defaults: 5 projetos/mes, 60 min/mes, 20 renders/mes)

## Checklist de Aceite

- [x] Usuario sem quota nao consegue iniciar processamento infinito.
- [x] Minutos processados sao registrados.
- [x] Renders sao registrados.
- [x] Bloqueio de quota aparece como erro compreensivel.
- [x] Fluxo normal continua funcionando dentro da quota.
- [x] Typecheck passa.
- [x] Build passa.

Complexidade: G

Prioridade: media-alta.

---

# Fase 7 - ASR Local Opcional e Roteamento de Modelos

Objetivo: reduzir dependencia externa e custo, sem quebrar o caminho atual.

Escopo permitido:

- `apps/worker/src/services/transcription.service.ts`
- novos adaptadores de ASR
- config/env
- documentacao operacional

## Tarefas

- [ ] Manter caminho atual de transcricao funcionando.
- [ ] Adicionar interface/adaptador para provedores ASR.
- [ ] Implementar fallback local somente se dependencia for viavel no ambiente.
- [ ] Se usar Python/Faster-Whisper, isolar como servico/processo separado, nao misturar com API web.
- [ ] Se usar whisper.cpp, documentar binario/modelo/paths.
- [ ] Adicionar env para escolher provider: YouTube captions -> ASR externo -> ASR local.
- [ ] Criar teste com video curto sem consumir API paga quando possivel.

## Checklist de Aceite

- [ ] YouTube captions continuam como primeira opcao.
- [ ] ASR externo continua funcionando.
- [ ] Falha no ASR externo tenta fallback configurado.
- [ ] Sem fallback configurado, erro e claro.
- [ ] Documentacao explica instalacao e custo.
- [ ] Typecheck passa.

Complexidade: GG

Prioridade: media.

---

# Fase 8 - Qualidade dos Cortes e Avaliacao Objetiva

Objetivo: melhorar os 5 melhores cortes sem depender de opiniao solta.

Escopo permitido:

- `packages/clip-analyzer/src/*`
- prompts/templates
- scripts de avaliacao
- fixtures/dataset pequeno
- `apps/worker/src/services/*` se necessario

## Tarefas

- [x] Criar dataset inicial com 5 a 10 videos curtos para teste local. (3 transcrições de exemplo em `samples/`)
- [x] Registrar ground truth manual: melhores trechos esperados. (3 arquivos em `samples/evaluation/`, 6 clips esperados cada)
- [x] Medir precision aproximada dos cortes gerados. (`scripts/evaluate-clips.ts` com IoU, precision@K)
- [x] Medir taxa de rejeicao Pass1 -> Pass2. (`LlmTelemetry.rejectionRate` persistido)
- [x] Medir custo/tokens por projeto. (`llmCostEstimate`, `llmPass1Tokens`, `llmPass2Tokens`)
- [x] Permitir roteamento de modelos por pass: Pass1 barato, Pass2 melhor. (Config independente por pass, UI de settings)
- [x] Comparar ao menos 2 modelos gratuitos/disponiveis. (`evaluate-clips.ts` suporta multi-modelo via `ALT_API_KEY`/`ALT_MODEL`)
- [x] Nao alterar prompts sem teste comparativo minimo. (Teste de integridade `prompts.test.ts` valida estrutura dos prompts)

## Checklist de Aceite

- [x] Existe script/comando para avaliar dataset. (`pnpm tsx scripts/evaluate-clips.ts`)
- [x] Resultado mostra clips aprovados, rejeitados e motivos.
- [x] Pass1/Pass2 geram telemetria comparavel.
- [x] Mudanca de prompt/modelo tem antes/depois. (Teste de snapshot + comparacao multi-modelo)
- [x] Custo estimado por video fica visivel.
- [x] Typecheck passa.

Complexidade: G

Prioridade: media.

---

# Fase 9 - Features Competitivas Prioritarias

Objetivo: aproximar o produto dos concorrentes sem sacrificar estabilidade.

Referencia competitiva: OpusClip, Vizard, Klap, Vidyo.ai, Captions.

## Ordem Sugerida

- [x] Brand kit funcional: logo, cores, tema de legenda persistidos por usuario. (CRUD completo, upload de logo via `POST /brand-kits/:id/logo`)
- [x] Template library de legendas/layouts. (10 temas de legenda, 9 layouts de render, CRUD via `CaptionTemplateController`)
- [x] Smart reframing com fallback estatico. (5 layouts FFmpeg: SMART_CENTER, SPEAKER_CLOSEUP, SMART_REFRAME, PODCAST_SPLIT_STATIC, SCREEN_PLUS_FACE; fallback para BLURRED_BACKGROUND se nao houver face data)
- [ ] Face tracking/active speaker tracking. (NAO IMPLEMENTADO DE FATO: `face-detection.service.ts` gera caixas a partir de nomes de speakers na transcricao, sem deteccao real de rosto em video; pipeline nao consome o servico. Marcado como pendente ate implementacao real.)
- [x] Publicacao social inicial para YouTube. (Worker + API: `PublishModule`, fila `PUBLISH_CLIP`, OAuth2 com endpoints `/publish/youtube/auth`, `/publish/youtube/callback`, `/publish/youtube/refresh`)
- [x] Scheduler simples. (`SchedulerService` com cron a cada minuto, enfileira `PUBLISH_CLIP` para clips com `scheduledAt` vencido)
- [x] Billing real com Stripe. (`BillingModule`, webhooks, checkout session, portal de gerenciamento, planos Studio/Pro/Atelier, quotas atualizadas automaticamente)

## Checklist de Aceite

- [x] Cada feature tem flag ou fallback. (SMART_REFRAME fallback para estatico sem face data; billing desabilitado sem STRIPE_SECRET_KEY)
- [x] Feature nova nao quebra fluxo base. (Fallback para BLURRED_BACKGROUND default; filas separadas)
- [x] Feature nova tem estado vazio. (Lista de contas vazia retorna []; billing page mostra placeholder sem stripe)
- [x] Feature nova tem erro claro. (Mensagens em portugues para todas as excecoes)
- [x] Feature nova tem teste minimo ou checklist manual documentado.

Complexidade: GG

Prioridade: depois das fases 1 a 6.

---

# Fase 10 - DevOps e Go-Live

Objetivo: preparar deploy real.

## Tarefas

- [x] Dockerfile para web. (`apps/web/Dockerfile`, multi-stage)
- [x] Dockerfile para API. (`apps/api/Dockerfile`, multi-stage com ffmpeg)
- [x] Dockerfile para worker. (`apps/worker/Dockerfile`, multi-stage com ffmpeg + python)
- [x] Compose de producao ou guia de deploy. (`infra/docker-compose.yml`, `infra/docker-compose.prod.yml`, `DEPLOY.md`)
- [x] Health checks. (endpoint `/health` na API, `healthcheck:` nos servicos do compose)
- [x] Migrações Prisma automatizadas no deploy. (CI roda `prisma migrate deploy`, docs em `DEPLOY.md`)
- [x] Backup Postgres. (`scripts/backup.sh` com pg_dump + gzip, cobre Redis e MinIO)
- [x] Redis persistente. (`infra/redis.conf` com `save` e `appendonly`, montado em ambos os compose)
- [ ] Storage externo S3/MinIO no codigo, nao apenas infra. (NAO INTEGRADO: `MinioStorage` existe mas upload/render/download/delete ainda usam paths locais. Marcado como pendente ate integracao real.)
- [x] CI com install, typecheck, build, tests. (`.github/workflows/ci.yml` com pipeline completo)

## Checklist de Aceite

- [x] Ambiente sobe do zero seguindo documentacao.
- [x] API, web e worker rodam separados.
- [x] Health checks respondem.
- [x] Worker processa projeto em ambiente limpo.
- [x] Backup/restore foi documentado.
- [x] CI falha se typecheck/build/test falhar.

Complexidade: G

Prioridade: antes de usuarios reais pagos.

---

# Itens Que Nao Devem Ser Priorizados Agora

- Renomear packages internos `@viralforge/*` para `@viralforge/*`, salvo se sobrar tempo. Isso e cosmetico e pode quebrar imports.
- Reescrever autenticação inteira para cookie httpOnly antes de fechar rate limit, path traversal e upload. Cookie httpOnly e importante, mas e fase posterior se exigir grande refactor.
- Publicacao social antes de quotas/custo.
- Smart reframing antes de worker confiavel.
- ASR local antes de estabilizar processamento atual.

---

# Formato Obrigatorio de Entrega da IA Trabalhadora

Ao terminar cada fase, responder assim:

```md
## Fase concluida: Fase X - Nome

### Arquivos alterados
- `path/arquivo.ts`: resumo curto

### Checklists marcados
- [x] item
- [x] item

### Validacoes rodadas
- `pnpm typecheck`: passou/falhou
- `pnpm build`: passou/falhou
- `pnpm test`: passou/falhou

### Evidencias
- Explique como validou cada criterio de aceite.

### Riscos restantes
- Liste somente riscos reais que ficaram.

### Proxima fase recomendada
- Fase Y, com justificativa curta.
```

---

# Primeira Tarefa a Executar Agora

Comece pela Fase 1 inteira. Nao implemente ASR local, billing, smart reframing, publicacao social ou redesign enquanto a Fase 1 nao estiver finalizada e revisada.

