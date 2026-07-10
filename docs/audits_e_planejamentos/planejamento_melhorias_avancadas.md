# Planejamento de Melhorias Avancadas - ViralForge

Data: 2026-05-22
Base: consolidacao das analises DeepSeek, GPT-5.5, MiniMax, Qwen, Claude e Gemini, ajustada ao estado atual do codigo.

## Objetivo

Transformar o ViralForge de MVP avancado em produto operavel em producao, competitivo contra Opus Clip, Vizard, Klap/Submagic e similares, mantendo o diferencial principal: PT-BR nativo, baixo custo, arquitetura controlavel e pipeline de IA em duas passagens.

## Premissas do Estado Atual

Ja existe:

- Monorepo TypeScript com Web Next.js, API NestJS, Worker, Prisma, Redis/BullMQ e storage local/S3 compativel.
- Pipeline completo: criar projeto, baixar video, obter legenda/transcricao, analisar cortes, renderizar, listar resultados, editor e download.
- IA Pass 1 + Pass 2 com prompts editoriais, validacao e score multidimensional.
- Render FFmpeg/Remotion e temas de legenda.
- Microservico GPU remoto para render e face tracking inicial.
- YouTube captions como caminho rapido de transcricao.
- DLQ no worker.
- Safe path helper em downloads.
- Cleanup basico de arquivos de projetos/clips.
- Rate limit global basico, ainda in-memory.
- Brand Kit, Billing e Publicacao YouTube parcialmente implementados.

Ainda precisa amadurecer:

- Sessao segura com refresh token/cookie httpOnly.
- Rate limit/brute force em Redis.
- Testes E2E e integracao.
- Observabilidade real por etapa.
- Face tracking com qualidade profissional.
- Publicacao TikTok/Instagram/LinkedIn.
- Storage/CDN/signed URLs para producao.
- UX de onboarding, filtros, notificacoes e estados vazios.
- B-roll, edicao por texto e analytics externos em fases posteriores.

---

# Fase 0 - Baseline e Congelamento de Qualidade

Prioridade: critica
Objetivo: parar de evoluir no escuro. Medir tempo, custo, falha e qualidade antes das proximas grandes mudancas.

## Tarefas

- [ ] Criar dataset interno com 10 videos curtos PT-BR de categorias diferentes: podcast, entrevista, aula, live, palestra.
- [ ] Para cada video, anotar manualmente 3 a 5 cortes bons esperados.
- [ ] Criar script `scripts/evaluate-pipeline.ts` para rodar pipeline e gerar relatorio.
- [ ] Medir tempo por etapa: download, captions, extracao audio, ASR, Pass 1, Pass 2, render, upload/download.
- [ ] Medir taxa de falha por etapa.
- [ ] Medir custo por provider: tokens pass1/pass2, ASR externo, tempo GPU.
- [ ] Registrar quantos candidatos Pass 1 gerou, quantos Pass 2 aprovou e quantos rejeitou.
- [ ] Criar tabela/registro de `PipelineRunMetric` ou arquivo estruturado temporario para baseline.
- [ ] Criar checklist manual de qualidade dos clips: abertura, fechamento, contexto, legenda, video, audio, reframe.

## Criterio de Aceite

- [ ] Existe relatorio com tempo medio por etapa em pelo menos 10 videos.
- [x] Existe taxa de falha conhecida por etapa.
- [ ] Existe amostra manual comparando clips gerados vs cortes esperados.
- [x] Qualquer melhoria futura pode ser comparada contra esse baseline.

---

# Fase 1 - Seguranca e Sessao de Producao

Prioridade: critica
Objetivo: eliminar riscos basicos antes de aceitar usuarios reais.

## 1.1 Refresh Token + Cookie HttpOnly

Problema: token no frontend persistido aumenta risco em caso de XSS e nao ha rotacao de sessao madura.

Tarefas:

- [x] Criar model `RefreshToken` no Prisma com `userId`, `tokenHash`, `family`, `expiresAt`, `revokedAt`, `createdAt`.
- [x] Access token curto: 15 minutos.
- [x] Refresh token: 7 a 30 dias em cookie `httpOnly`, `Secure`, `SameSite=Lax` ou `Strict` conforme ambiente.
- [x] Endpoint `POST /auth/refresh` com rotacao de refresh token a cada uso.
- [x] Detectar reuso de refresh revogado e revogar familia inteira.
- [x] Endpoint `POST /auth/logout` revogando refresh atual.
- [x] Endpoint `POST /auth/logout-all` revogando todos os tokens do usuario.
- [x] Frontend manter access token em memoria, nao em localStorage.
- [x] Interceptor/fetch wrapper: em `401`, chama `/auth/refresh` e repete request uma vez.
- [x] Limpar chaves antigas de auth do localStorage na migracao.

Criterio de aceite:

- [x] Nenhum JWT valido fica persistido em localStorage.
- [x] Refresh token rotaciona a cada uso.
- [x] Logout invalida sessao no backend.
- [x] Reuso de refresh token antigo bloqueia a familia.

## 1.2 Rate Limit e Brute Force em Redis

Problema: rate limit e brute force em memoria nao sobrevivem restart e nao escalam para multiplas instancias.

Tarefas:

- [x] Substituir store `Map` do throttler por Redis.
- [x] Substituir `bruteForceStore` in-memory por Redis.
- [x] Chaves por IP, usuario e email normalizado.
- [x] Limites diferenciados:
  - Auth/login: 5 a 10 tentativas por janela.
  - Upload/criacao projeto: limite menor por usuario.
  - API geral: limite maior por usuario/IP.
- [x] Retornar headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- [x] Manter fallback in-memory se Redis cair, com log de alerta.

Criterio de aceite:

- [ ] Tentativas erradas continuam bloqueadas apos restart da API.
- [ ] Rate limit funciona com duas instancias da API.
- [ ] Login nao revela se email existe.

## 1.3 Hardening Geral

Tarefas:

- [x] Garantir ValidationPipe com whitelist e forbidNonWhitelisted onde aplicavel.
- [x] Revisar todos endpoints de download para uso de `assertPathInsideStorage`.
- [x] Validar magic bytes em uploads de video.
- [ ] Remover qualquer segredo hardcoded.
- [x] Validar `.env` no bootstrap com schema.
- [x] Adicionar security headers basicos.
- [x] Garantir CORS restrito por `WEB_ORIGIN` em producao.
- [x] Criar audit log minimo para login, logout, upload, delete project, publish.

Criterio de aceite:

- [x] Security smoke test passa: path traversal, auth bypass, upload invalido, rate limit.
- [x] Erros em producao nao vazam stack trace.

---

# Fase 2 - Observabilidade, Jobs e Confiabilidade

Prioridade: critica
Objetivo: quando algo der errado, saber exatamente onde, por que e em quanto tempo.

## 2.1 Logs Estruturados

Tarefas:

- [x] Padronizar logger estruturado na API e Worker.
- [x] Adicionar `requestId`, `userId`, `projectId`, `jobId`, `clipId` nos logs.
- [x] Sanitizar secrets, tokens, API keys e Authorization headers.
- [ ] Trocar `console.log` de producao por logger.
- [x] Criar niveis: debug, info, warn, error.

Criterio de aceite:

- [ ] Um erro de render mostra user/project/job/clip sem expor segredo.
- [ ] Busca por `projectId` reconstrui o fluxo inteiro.

## 2.2 Metricas de Pipeline

Tarefas:

- [x] Persistir metricas por job: `downloadSec`, `captionSec`, `audioSec`, `asrSec`, `pass1Sec`, `pass2Sec`, `renderSec`, `totalSec`.
- [x] Persistir provider/model usado em Pass 1, Pass 2 e ASR.
- [x] Persistir tokens input/output e custo estimado.
- [x] Persistir `fallbackUsed`, `remoteGpuUsed`, `renderEngine`, `faceTrackingUsed`.
- [x] Criar dashboard operacional interno simples em `/dashboard/quality` ou `/dashboard/analytics`.
- [x] Expor endpoint `/health/ready` validando DB, Redis e storage.
- [x] Expor endpoint `/health/live`.

Criterio de aceite:

- [x] Cada projeto concluido exibe tempo por etapa.
- [x] Cada projeto falho exibe etapa exata da falha.
- [x] Da para comparar render local vs GPU por dados, nao por achismo.

## 2.3 Jobs Idempotentes e Sem Duplicacao

Tarefas:

- [x] Garantir `jobId` deterministico para processamento de projeto.
- [ ] Antes de processar, verificar status atual do projeto e clips existentes.
- [x] Reprocessamento deve apagar/substituir clips anteriores ou versionar de forma explicita.
- [x] Evitar clips duplicados em retry.
- [x] Ao apagar projeto durante processamento, worker deve parar sem retry infinito.
- [x] DLQ deve guardar payload sanitizado e erro.
- [ ] Endpoint/admin command para reprocessar DLQ.

Criterio de aceite:

- [x] Retry nao duplica clips.
- [x] Projeto deletado nao reaparece por cache ou job atrasado.
- [x] Falha permanente vai para DLQ e fica visivel.

---

# Fase 3 - Testes Reais e Garantia de Regressao

Prioridade: critica
Objetivo: impedir que bugs antigos voltem: video sem play, projeto sumindo, usuario vendo dado errado, corte sem arquivo.

## 3.1 Testes Unitarios Essenciais

Tarefas:

- [ ] Auth service: login, senha errada, brute force, refresh, logout.
- [ ] Projects service: create, list por usuario, delete com cleanup.
- [ ] Clips service/controller: acesso autorizado, arquivo inexistente, path seguro.
- [ ] Worker video processor: fluxo por captions, fallback ASR, projeto deletado.
- [ ] Remote rendering service: sucesso, timeout, fallback local.
- [ ] Clip analyzer: parse JSON, schema, ranking, deduplicacao.

Criterio de aceite:

- [ ] Cobertura minima de services criticos acima de 60%.
- [ ] Testes rodam no CI/local sem depender de provider externo real.

## 3.2 Testes de Integracao API

Tarefas:

- [ ] Auth: register -> login -> refresh -> logout.
- [ ] Projects: criar/listar/deletar garantindo isolamento por usuario.
- [ ] Clips: baixar video/thumbnail/vtt com token correto e negar outro usuario.
- [ ] Settings/providers: salvar chave, mascarar, testar provider fake.
- [ ] Billing: criar checkout quando Stripe configurado e erro claro quando nao configurado.

Criterio de aceite:

- [ ] Usuario A nunca acessa projeto/clip do usuario B.
- [ ] Download de video retorna `Content-Type: video/mp4` quando arquivo existe.
- [ ] Deletar projeto remove do banco e da listagem imediatamente.

## 3.3 E2E Playwright

Tarefas:

- [ ] Login com usuario padrao.
- [ ] Criar projeto com video curto de teste.
- [ ] Acompanhar tela de processamento.
- [ ] Ver resultado.
- [ ] Dar play no clip.
- [ ] Abrir editor profissional.
- [ ] Apagar projeto.
- [ ] Logout/login e confirmar que projeto apagado nao reaparece.

Criterio de aceite:

- [ ] E2E cobre o fluxo que mais quebrou em producao.
- [ ] E2E roda em CI ou script local com fixture pequena.

---

# Fase 4 - Face Tracking Profissional e Render GPU

Prioridade: alta
Objetivo: transformar o smart reframe em diferencial visual real, sem tremedeira e sem cortes errados de rosto.

## 4.1 Detector e Tracking

Estado atual: microservico GPU com YOLO11n-face e crop dinamico inicial.

Tarefas:

- [ ] Comparar YOLO11n-face vs YOLO11s-face em dataset pequeno.
- [ ] Manter YOLO11n se a melhora do `s` nao compensar tempo.
- [ ] Salvar face track por timestamp no `faceTrackJson`.
- [ ] Detectar multiplos rostos e escolher alvo estavel.
- [ ] Criar score de estabilidade por rosto.
- [ ] Fallback se rosto sumir: manter ultima posicao por ate 1s antes de voltar ao centro.
- [ ] Nao trocar de rosto sem criterio de confianca/tempo minimo.

Criterio de aceite:

- [ ] Em video talking head, rosto fica dentro da zona segura em >95% dos frames amostrados.
- [ ] Em podcast com 2 pessoas, nao troca de pessoa de forma caotica.

## 4.2 Camera Virtual Cinematografica

Tarefas:

- [ ] Implementar deadzone configuravel: x 8-15%, y 10-20%.
- [ ] Implementar EMA smoothing configuravel.
- [ ] Implementar limite de velocidade por frame.
- [ ] Implementar limite de aceleracao.
- [ ] Aplicar composicao: rosto um pouco acima do centro, preservando ombros/peito quando possivel.
- [ ] Evitar cortar testa/queixo com margem minima.
- [ ] Se movimento necessario for grande, usar transicao mais rapida no inicio do clip, nao demorar 20s para chegar no rosto.
- [ ] Criar presets:
  - `stable`: pouco movimento.
  - `responsive`: segue mais rapido.
  - `cinematic`: suave com deadzone maior.

Criterio de aceite:

- [ ] Movimento nao parece tremido.
- [ ] Camera nao fica caminhando lentamente por 20s ate o rosto.
- [ ] Rosto nao fica pela metade no crop final.
- [ ] Usuario consegue escolher preset no editor ou projeto.

## 4.3 GPU Como Caminho Pesado Principal

Tarefas:

- [ ] Garantir que render pesado use microservico GPU quando disponivel.
- [ ] Fallback automatico para local se GPU off.
- [ ] Enviar video/audio uma vez para GPU por projeto e reutilizar nos clips.
- [ ] Evitar baixar o mesmo video nas duas maquinas.
- [ ] Medir tempo de upload para GPU, render e download do resultado.
- [ ] Cleanup remoto sempre apos job ou por TTL.
- [ ] Endpoint health da GPU com modelo carregado e memoria disponivel.

Criterio de aceite:

- [ ] Se GPU estiver online, render usa GPU.
- [ ] Se GPU estiver offline, sistema conclui localmente com log de fallback.
- [ ] Arquivos temporarios remotos sao apagados.

---

# Fase 5 - UX de Produto Vendavel

Prioridade: alta
Objetivo: reduzir abandono e sensacao de MVP.

## 5.1 Tela de Espera e Feedback

Estado atual: nova tela de processamento visual criada, mas precisa validar em uso real.

Tarefas:

- [ ] Mostrar etapa real do worker, nao apenas progresso generico.
- [ ] Mostrar mensagens especificas por etapa: baixando, lendo legenda, analisando, renderizando.
- [ ] Mostrar que pode fechar a pagina.
- [ ] Mostrar erro recuperavel com botao tentar novamente.
- [ ] Mostrar tempo estimado apenas quando houver baseline confiavel.
- [ ] Evitar elementos falsos demais que prometam clips antes da conclusao.

Criterio de aceite:

- [ ] Usuario entende que o sistema esta trabalhando.
- [ ] Se demorar, sabe em qual etapa esta.
- [ ] Se falhar, entende o motivo e tem acao.

## 5.2 Novo Projeto

Tarefas:

- [ ] Preview real de layout e legenda no modal.
- [ ] Legenda escolhida deve se parecer com o render final.
- [ ] Usar frame/visual estilo podcast, nao icones genericos.
- [ ] Explicar `SMART_REFRAME`, `FILL_CROP`, `PODCAST_SPLIT` com mini-preview.
- [ ] Validar URL antes de enviar.
- [ ] Indicar quando video nao tem legenda YouTube e pode demorar mais.

Criterio de aceite:

- [ ] Usuario consegue escolher tema/layout vendo resultado aproximado.
- [ ] Nao existe diferenca gritante entre preview e video renderizado.

## 5.3 Resultados de Projeto

Tarefas:

- [ ] Manter pagina de resultados limpa, sem editor embutido.
- [ ] Filtros funcionais: status, score minimo, precisa revisao, render falhou.
- [ ] Busca por titulo/texto do clip.
- [ ] Play inline confiavel sem modal desnecessario.
- [ ] Botao claro para editor profissional.
- [ ] Download um por vez, sem ZIP se nao estiver implementado.
- [ ] Estado vazio para nenhum clip gerado.

Criterio de aceite:

- [ ] Resultado parece produto final, nao painel tecnico.
- [ ] Clip deletado/projeto deletado nao reaparece apos relogar.

## 5.4 Onboarding

Tarefas:

- [ ] Wizard para primeiro acesso: o que e ViralForge, como criar projeto, como configurar IA se necessario.
- [ ] Projeto exemplo opcional.
- [ ] Botao para rever tutorial em settings.
- [ ] Empty state do dashboard com CTA claro.

Criterio de aceite:

- [ ] Usuario novo sabe o que fazer sem perguntar.

---

# Fase 6 - Publicacao Social e Calendario

Prioridade: alta
Objetivo: transformar o ViralForge de ferramenta de corte em fluxo de distribuicao.

## 6.1 Plataformas

Tarefas:

- [ ] YouTube Shorts: revisar fluxo existente e estabilizar.
- [ ] TikTok Content Posting API.
- [ ] Instagram Graph API para Reels, exigindo conta Business/Creator.
- [ ] LinkedIn video post.
- [ ] Facebook Reels se fizer sentido comercial.
- [ ] X/Twitter apenas se custo/API compensar.

Criterio de aceite:

- [ ] Usuario conecta pelo menos YouTube, TikTok e Instagram.
- [ ] Publica um clip com titulo/descricao/hashtags.
- [ ] Status da publicacao volta para o sistema.

## 6.2 Scheduler

Tarefas:

- [ ] Calendario visual.
- [ ] Agendamento por plataforma.
- [ ] Fuso horario do usuario.
- [ ] Regras simples: publicar melhores scores primeiro.
- [ ] Historico de publicacoes.
- [ ] Retry com erro claro quando plataforma rejeitar.

Criterio de aceite:

- [ ] Usuario consegue agendar 5 clips em plataformas diferentes.
- [ ] Falha de API social nao quebra o projeto.

## 6.3 Metadados por Plataforma

Tarefas:

- [ ] Gerar titulo curto para TikTok/Reels.
- [ ] Gerar descricao YouTube.
- [ ] Gerar hashtags por tema.
- [ ] Permitir edicao manual antes de publicar.
- [ ] Salvar metadados por plataforma.

Criterio de aceite:

- [ ] O mesmo clip pode ter texto diferente por plataforma.

---

# Fase 7 - Storage, CDN, Billing e Produto SaaS

Prioridade: alta
Objetivo: deixar pronto para usuario pagante e arquivos grandes.

## 7.1 Storage Cloud

Tarefas:

- [ ] Definir storage alvo: Cloudflare R2, AWS S3 ou MinIO externo.
- [ ] Criar abstracao unica para storage local/cloud.
- [ ] Mover uploads originais, clips, thumbnails, srt/vtt/ass para storage.
- [ ] Signed URLs com expiracao.
- [ ] CDN para entrega dos videos.
- [ ] Politica de retencao por plano.
- [ ] Cleanup real ao deletar projeto.

Criterio de aceite:

- [ ] Web/API nao dependem de path local para servir video em producao.
- [ ] Download/play usa URL assinada ou proxy seguro.

## 7.2 Billing e Quotas

Tarefas:

- [ ] Fechar checkout Stripe no frontend.
- [ ] Portal do cliente.
- [ ] Planos reais em reais.
- [ ] Quota por minutos processados, renders e storage.
- [ ] Bloqueio claro ao exceder quota.
- [ ] Historico de uso por projeto.
- [ ] Webhooks Stripe idempotentes.
- [ ] Trial/cupom se necessario.

Criterio de aceite:

- [ ] Usuario paga, ganha quota, processa e ve consumo.
- [ ] Sem pagamento/sem quota nao inicia job pesado.

---

# Fase 8 - Qualidade dos Cortes e IA Multimodal

Prioridade: media/alta
Objetivo: melhorar a escolha dos 5 melhores cortes, nao apenas gerar cortes.

## 8.1 Refinar Pass 1 e Pass 2

Tarefas:

- [ ] Manter Pass 1 barato e objetivo.
- [ ] Pass 1 retorna hints estruturados: opening, closing, independence, emotion.
- [ ] Pass 2 retorna scores puros, sem ranking agregado.
- [ ] Backend calcula ranking final.
- [ ] Backend extrai texto literal por timestamp, nao LLM.
- [ ] Logar `pass1_agreement`: confirmed/refined/rejected/surprised.
- [ ] Medir taxa de rejeicao ideal: 35-50%.

Criterio de aceite:

- [ ] Prompts pequenos, claros e versionados.
- [ ] Ranking pode ser ajustado sem alterar prompt.
- [ ] Taxa de rejeicao Pass 2 monitorada.

## 8.2 Sinais Multimodais

Tarefas:

- [ ] Energia de audio: volume, variacao, pausa, risada, grito.
- [ ] Expressao facial: sorriso, surpresa, intensidade.
- [ ] Movimento/corte visual.
- [ ] Active speaker em podcasts.
- [ ] Penalizar trecho visualmente ruim.
- [ ] Boost para momento com pico de emocao.

Criterio de aceite:

- [ ] Score final melhora no dataset humano.
- [ ] Nao aumenta tempo total de processamento de forma inviavel.

---

# Fase 9 - B-roll, Musica, Memes e Edicao Automatica

Prioridade: media
Objetivo: criar estilos de edicao automatica sem comprometer velocidade.

## 9.1 Pacotes de Estilo

Tarefas:

- [ ] Criar presets: limpo, podcast premium, engracado, polemico, educativo, cortes rapidos.
- [ ] Cada preset define legenda, zoom, cortes, transicoes, SFX e B-roll.
- [ ] Usuario escolhe no projeto ou editor.
- [ ] Preview visual antes de render.

Criterio de aceite:

- [ ] Preset muda realmente o video, nao apenas a cor.

## 9.2 B-roll e Assets

Tarefas:

- [ ] Extrair conceitos por trecho.
- [ ] Buscar Pexels/Pixabay/Unsplash ou biblioteca propria.
- [ ] Baixar/cachear assets.
- [ ] Inserir B-roll apenas quando fizer sentido.
- [ ] Usuario pode desligar/remover B-roll.
- [ ] Evitar assets com direitos duvidosos.

Criterio de aceite:

- [ ] B-roll relevante em pelo menos 70% dos casos aprovados manualmente.
- [ ] Tempo adicional por clip aceitavel.

## 9.3 Musica e SFX

Tarefas:

- [ ] Biblioteca de musicas royalty-free por mood.
- [ ] Classificar clip: serio, inspirador, engracado, polemico, tutorial.
- [ ] Mixar musica em volume baixo com ducking quando ha fala.
- [ ] Inserir SFX apenas em presets que pedem isso.
- [ ] Botao para remover musica/SFX.

Criterio de aceite:

- [ ] Audio da fala continua claro.
- [ ] Musica nao cria risco de copyright.

---

# Fase 10 - Editor por Texto, API e Times

Prioridade: media
Objetivo: evoluir para produto profissional/agencias.

## 10.1 Editor por Texto

Tarefas:

- [ ] Exibir transcricao sincronizada no editor.
- [ ] Selecionar frase/palavra e ajustar inicio/fim.
- [ ] Remover trecho via texto.
- [ ] Split/merge clips.
- [ ] Undo/redo.
- [ ] Versoes de render.

Criterio de aceite:

- [ ] Usuario ajusta corte sem mexer manualmente em timeline complexa.

## 10.2 API Publica e Webhooks

Tarefas:

- [ ] API keys por usuario/workspace.
- [ ] Swagger/OpenAPI publico.
- [ ] Endpoint submit video.
- [ ] Endpoint status.
- [ ] Endpoint list clips/download.
- [ ] Webhook `project.completed`, `project.failed`, `clip.rendered`.
- [ ] Rate limit por API key.

Criterio de aceite:

- [ ] Agencia consegue integrar ViralForge no proprio fluxo.

## 10.3 Workspaces e Times

Tarefas:

- [ ] Model Workspace.
- [ ] Convites por email.
- [ ] Roles: owner, admin, editor, viewer.
- [ ] Projetos por workspace.
- [ ] Brand kits por workspace.
- [ ] Audit log por workspace.

Criterio de aceite:

- [ ] Agencia com mais de uma pessoa usa sem compartilhar senha.

---

# Priorizacao Recomendada Imediata

Se a proxima execucao for feita por uma IA trabalhadora, seguir esta ordem:

1. Fase 0: baseline minimo e metricas por etapa.
2. Fase 1.2: Redis para rate limit/brute force.
3. Fase 3.2 e 3.3: testes de integracao/E2E para bugs recorrentes.
4. Fase 4.2: melhorar camera virtual do face tracking.
5. Fase 5.3: pagina de resultados limpa, filtros e play confiavel.
6. Fase 2.2: persistir metricas de pipeline no banco.
7. Fase 6: TikTok/Instagram depois que fluxo base estiver estavel.

---

# Lista de Bugs Historicos Que Nao Podem Voltar

- [ ] Projeto deletado reaparecer apos logout/login.
- [ ] Usuario ver projeto/clip de outro usuario.
- [ ] Clip renderizado sem video/audio/imagem.
- [ ] Play do video funcionar no editor mas nao na pagina de resultados.
- [ ] Worker ficar em loop renderizando por horas.
- [ ] Projeto travar eternamente em processing sem timeout/falha clara.
- [ ] Render pesado rodar localmente quando GPU esta disponivel.
- [ ] GPU off quebrar o sistema em vez de cair para fallback local.
- [ ] Legenda escolhida no modal parecer diferente do render final.
- [ ] Face tracking cortar metade do rosto ou demorar demais para centralizar.

---

# Indicadores de Produto

Acompanhar semanalmente:

- Tempo medio para video de 10min, 30min e 60min.
- Tempo medio por clip renderizado.
- Taxa de falha por etapa.
- Percentual de jobs usando GPU.
- Percentual de fallback local.
- Custo medio por minuto processado.
- Taxa de aprovacao Pass 2.
- Clips bons por projeto segundo avaliacao humana.
- Quantos usuarios baixam pelo menos 1 clip.
- Quantos usuarios abrem editor apos resultado.
- Quantos projetos sao apagados logo apos geracao.

---

# Veredito Consolidado

O ViralForge nao precisa de mais ideias soltas agora. Precisa de execucao disciplinada em base, confiabilidade e acabamento.

As analises mais uteis foram Claude, GPT-5.5 e DeepSeek. MiniMax, Qwen e Gemini serviram para reforcar gaps competitivos, mas algumas notas e diagnosticos ficaram desatualizados.

A sequencia correta e:

1. Medir.
2. Proteger.
3. Testar.
4. Estabilizar GPU/render.
5. Melhorar UX principal.
6. Publicar em redes.
7. Adicionar features premium.

Sem as fases 0 a 5, B-roll, musica, API publica e multi-tenant so aumentam complexidade em cima de uma base ainda instavel.
