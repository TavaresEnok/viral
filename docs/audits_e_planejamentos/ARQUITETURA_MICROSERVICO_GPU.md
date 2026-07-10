# Arquitetura: Microservico GPU Remoto

## Decisao

Usar uma segunda VM com GPU como microservico remoto de processamento pesado, sem migrar o sistema principal para ela e sem storage compartilhado.

A comunicacao operacional atual usa IP publico via SSH, mas sem expor a porta HTTP do microservico para a internet:

- VM GPU: `168.194.15.42`
- SSH publico: porta `22563`
- Microservico na VM GPU: `127.0.0.1:9873`
- Túnel persistente na VM principal: `127.0.0.1:9873 -> 127.0.0.1:9873` na VM GPU
- Unit local: `node-link.service`
- Unit remota: `node-agent.service`

Motivo: a porta publica `168.194.15.42:9873` nao fica acessivel de fora mesmo com o servico ouvindo dentro da VM, indicando bloqueio/NAT/firewall externo ao guest. O túnel usa a porta SSH publica que ja funciona e mantem o HTTP fechado em loopback.

## Estado Atual Validado

- `node-agent.service` ativo na VM GPU.
- `node-link.service` ativo e habilitado na VM principal.
- Health local via tunel validado: `http://127.0.0.1:9873/health`.
- GPU detectada no health: `accelerator=true`.
- Teste real com video curto validado:
  - URL: `https://www.youtube.com/watch?v=qfcJ-4T5dCQ`
  - Duracao detectada: `455.3085s`
  - Modelo: `small`
  - Dispositivo solicitado: `cuda`
  - Dispositivo usado: `cuda`
  - Download/extracao audio: `19.668s`
  - Transcricao: `32.961s`
  - Total: `52.629s`
  - Segmentos: `90`
- Teste autenticado via tunel local validado:
  - Endpoint usado pela VM principal: `http://127.0.0.1:9873/v1/process`
  - Dispositivo usado: `cuda`
  - Download/extracao audio: `3.791s`
  - Transcricao: `8.971s`
  - Total: `12.762s`
  - Observacao: segunda execucao, com modelo/cache ja aquecidos.
- Comparativo ASR no mesmo video de `455.3085s`:
  - `small`: transcricao `9.047s`, total `13.011s`, `90` segmentos.
  - `large-v3`: transcricao `28.986s`, total `33.510s`, `133` segmentos.
  - `turbo`: transcricao `12.016s`, total `22.218s`, `153` segmentos.
  - `turbo + int8` via `faster-whisper`: transcricao aquecida `13.064s`, total `16.449s`, `154` segmentos.
  - Decisao atual: usar `turbo + int8` como padrao de producao do ASR remoto; manter `small` para teste rapido e `large-v3` para modo qualidade maxima.

Correcao aplicada no microservico remoto:

- O subprocesso do `yt-dlp` deve usar `sys.executable`, nao `python`, porque o ambiente do systemd pode nao ter `python` no PATH.

A VM principal continua dona de:

- Web
- API
- Banco de dados
- Redis/fila principal
- Storage local final
- Estado dos projetos/clips

A VM GPU fica responsavel apenas por tarefas pesadas e temporarias:

- Download de video quando fizer sentido
- Extracao de audio
- ASR local
- Renderizacao FFmpeg com GPU/NVENC
- Geracao de thumbnails
- Face tracking/smart reframing no futuro

Depois que a VM principal receber os artefatos finais, a VM GPU deve apagar todos os arquivos temporarios daquele job.

Regra obrigatoria de redundancia:

- A VM GPU e aceleradora, nao dependencia obrigatoria.
- Se o microservico GPU estiver offline, lento, falhando health check ou retornando erro, a VM principal deve executar o fluxo local atual.
- O usuario nao deve ficar bloqueado porque a VM GPU caiu.
- A falha da GPU deve ser registrada em log/status, mas o processamento deve continuar localmente quando possivel.

## Topologia

```txt
VM principal
web + api + banco + redis + storage local
        |
        | HTTP local via tunel SSH publico
        | http://127.0.0.1:9873
        v
VM GPU
node-agent.service
yt-dlp / ffmpeg / whisper / render / face tracking
        |
        | JSON + mp4 + thumbnails + legendas
        v
VM principal salva tudo no storage local atual
```

## Principio Central

Nao usar paths locais compartilhados entre VMs.

Errado:

```txt
/storage/uploads/projeto/original.mp4 em uma VM e tentar ler o mesmo path na outra
```

Certo:

```txt
Transferir arquivo ou URL via HTTP interno, processar na VM GPU, baixar artefatos finais de volta para a VM principal.
```

## Fluxo Para Video Por URL

1. Usuario cria projeto na VM principal.
2. Worker principal verifica se `GPU_WORKER_ENABLED=true`.
3. Worker principal chama `GET /health` da VM GPU com timeout curto.
4. Se a GPU estiver saudavel, envia job para VM GPU com `youtubeUrl`, configuracoes e callback opcional.
5. VM GPU baixa o video com `yt-dlp`.
6. VM GPU extrai audio.
7. VM GPU transcreve, renderiza ou executa a etapa solicitada.
8. VM GPU salva artefatos em uma pasta temporaria do job.
9. VM principal consulta status e baixa os artefatos.
10. VM principal salva artefatos no storage local atual.
11. VM principal atualiza banco.
12. VM principal chama endpoint de cleanup ou a VM GPU limpa automaticamente apos confirmacao.
13. Se qualquer etapa remota falhar antes de gerar artefatos finais, worker principal cai para o fluxo local atual.

## Fluxo Para Upload Local

1. Usuario faz upload na VM principal.
2. Worker principal verifica se a VM GPU esta saudavel.
3. Se estiver saudavel, API/worker principal envia o arquivo original para VM GPU via HTTP multipart ou upload em chunks.
4. VM GPU processa em pasta temporaria isolada por `jobId`.
5. VM principal baixa artefatos finais.
6. VM GPU remove temporarios apos confirmacao.
7. Se a VM GPU estiver offline, der timeout ou falhar antes de concluir, o worker principal processa localmente usando o fluxo atual.

## Endpoints Sugeridos

### `POST /jobs`

Cria um job remoto.

Body exemplo:

```json
{
  "jobId": "project_123_attempt_1",
  "type": "process_video",
  "source": {
    "kind": "youtube",
    "url": "https://www.youtube.com/watch?v=..."
  },
  "options": {
    "language": "pt-BR",
    "maxClips": 5,
    "renderLayout": "vertical",
    "captionTheme": "bold-yellow",
    "useGpu": true
  }
}
```

### `POST /jobs/:jobId/upload`

Envia arquivo original quando a origem for upload local.

Formato:

```txt
multipart/form-data
file=<video>
```

### `GET /jobs/:jobId`

Consulta status.

Resposta exemplo:

```json
{
  "jobId": "project_123_attempt_1",
  "status": "processing",
  "stage": "rendering",
  "progress": 72,
  "error": null,
  "artifacts": []
}
```

### `GET /jobs/:jobId/artifacts`

Lista artefatos finais.

Resposta exemplo:

```json
{
  "artifacts": [
    {
      "name": "clip-1.mp4",
      "type": "video/mp4",
      "size": 12345678,
      "sha256": "..."
    },
    {
      "name": "clip-1.vtt",
      "type": "text/vtt",
      "size": 1200,
      "sha256": "..."
    }
  ]
}
```

### `GET /jobs/:jobId/artifacts/:name`

Baixa um artefato final.

### `POST /jobs/:jobId/cleanup`

Confirma que a VM principal recebeu tudo e autoriza apagar temporarios.

Resposta:

```json
{
  "ok": true,
  "deletedBytes": 987654321
}
```

### `GET /health`

Health check do microservico GPU.

Resposta exemplo:

```json
{
  "ok": true,
  "gpu": true,
  "ffmpeg": true,
  "ytDlp": true,
  "whisper": true
}
```

## Estados do Job

```txt
queued
downloading
extracting_audio
transcribing
analyzing
rendering
upload_ready
completed
failed
cleaned
```

## Estrategia de Fallback Obrigatoria

O fluxo sempre deve ter fallback local.

Ordem:

```txt
1. Checar GPU_WORKER_ENABLED
2. Checar health check da VM GPU
3. Tentar etapa remota com timeout
4. Se sucesso: baixar artefatos e salvar localmente
5. Se falha antes de artefatos finais: executar etapa local
6. Registrar fallback_used=true e fallback_reason
```

Motivos de fallback:

```txt
gpu_disabled
gpu_healthcheck_failed
gpu_timeout
gpu_job_failed
gpu_artifact_download_failed
gpu_cleanup_failed
```

Regras:

- `gpu_cleanup_failed` nao deve invalidar o projeto se os artefatos ja foram recebidos.
- Falha remota durante upload para GPU deve cair para local.
- Falha remota depois de artefatos parcialmente baixados deve descartar os parciais e processar local, salvo se todos os checksums finais forem validos.
- Fallback local deve respeitar os mesmos limites de quota e timeout do pipeline normal.
- Logs devem indicar claramente quando a GPU foi usada e quando houve fallback.

## Limpeza de Arquivos Temporarios

Cada job deve usar uma pasta propria:

```txt
/var/tmp/viralforge-gpu/jobs/{jobId}/
```

Conteudo possivel:

```txt
original.mp4
audio.wav
transcript.json
clips/
thumbnails/
subtitles/
logs/
```

Regras:

- Apagar tudo apos `POST /jobs/:jobId/cleanup`.
- Apagar automaticamente jobs `completed` com mais de 2 horas.
- Apagar automaticamente jobs `failed` com mais de 24 horas.
- Nunca apagar job em `processing`.
- Nunca permitir `jobId` com `/`, `..`, espacos ou caracteres fora de whitelist.
- Toda delecao deve ficar restrita ao diretorio raiz temporario da VM GPU.

## Seguranca

- Nao expor a porta HTTP do microservico diretamente para a internet.
- O microservico deve ouvir em loopback ou estar protegido por firewall.
- A VM principal acessa por tunel SSH persistente usando IP publico e porta SSH autorizada.
- Usar token interno via header:

```txt
X-Node-Key: <token-forte>
```

- Validar tamanho maximo de upload.
- Validar magic bytes de video recebido.
- Bloquear path traversal em artifact download.
- Usar timeout por etapa.
- Limitar jobs simultaneos.
- Sanitizar logs para nao vazar tokens, URLs privadas ou headers.
- Opcional: assinar payload com HMAC no futuro.

## Configuracao Na VM Principal

Configuracao atual do tunel:

```txt
Unit: deploy/systemd-user/node-link.service
Local URL: http://127.0.0.1:9873
Remote SSH: root@168.194.15.42 -p 22563
Remote service: 127.0.0.1:9873
```

Variaveis futuras para integracao no worker principal:

```env
REMOTE_ACCEL_ENABLED=false
REMOTE_ACCEL_BASE_URL=http://127.0.0.1:9873
REMOTE_ACCEL_TOKEN=<token-forte>
REMOTE_ACCEL_TIMEOUT_MS=1800000
REMOTE_ACCEL_HEALTHCHECK_TIMEOUT_MS=3000
REMOTE_ACCEL_FALLBACK_TO_LOCAL=true
REMOTE_ACCEL_MAX_UPLOAD_MB=2048
REMOTE_ACCEL_STAGES=transcription,render
```

## Configuracao Na VM GPU

Configuracao atual:

```env
NODE_BIND=0.0.0.0
NODE_PORT=9873
NODE_KEY=<token-forte>
NODE_DIR=/home/ajustconsulting/projeto_enok_microservicos/node_agent/tmp
NODE_MODEL=turbo
NODE_DEVICE=cuda
NODE_BATCH_SIZE=1
NODE_COMPUTE_TYPE=int8
NODE_NORMALIZE_AUDIO=false
```

Observacao: apesar de `NODE_BIND=0.0.0.0`, o acesso externo continua bloqueado por firewall/NAT. O caminho suportado e o tunel SSH.

## Onde Usar GPU Primeiro

Prioridade recomendada:

1. ASR local com Whisper/Faster-Whisper.
2. Render FFmpeg com NVENC.
3. Face tracking/smart reframing.
4. Geracao de thumbnails em lote.
5. Analise visual avancada.

Nao priorizar GPU para:

- Pass 1/Pass 2 LLM via API externa.
- Download do YouTube quando gargalo for rede.
- Operacoes simples de banco/API.

## Integracao Com o Sistema Atual

A integracao deve ser adicionada como adaptador, nao como substituicao direta.

Exemplo:

```txt
VideoProcessorService
  -> se GPU_WORKER_ENABLED=true e etapa permitida
      testa health check e usa GpuWorkerClient
      se falhar e GPU_WORKER_FALLBACK_TO_LOCAL=true, usa fluxo local atual
  -> senao
      usa fluxo local atual
```

Isso permite desligar o microservico GPU sem quebrar o sistema.

## Critérios de Aceite

- VM principal consegue enviar um job para a VM GPU.
- VM GPU processa em pasta temporaria isolada por `jobId`.
- VM principal consegue baixar todos os artefatos finais.
- VM principal salva artefatos no storage local atual.
- VM principal atualiza banco normalmente.
- VM GPU apaga arquivos temporarios apos confirmacao.
- Falha na VM GPU nao derruba API principal.
- Se VM GPU estiver offline, o processamento roda localmente nesta VM.
- Se VM GPU der timeout, o processamento roda localmente nesta VM.
- Logs mostram `fallback_used=true` e o motivo do fallback.
- Com `GPU_WORKER_ENABLED=false`, fluxo local atual continua funcionando.

## Fase Futura No Plano De Execucao

Este trabalho deve entrar depois das fases de seguranca, storage cleanup e worker confiavel.

Ordem sugerida:

1. Fase 1: seguranca critica.
2. Fase 2: limpeza de storage.
3. Fase 3: worker/jobs travados.
4. Fase futura: microservico GPU remoto.

Motivo: antes de distribuir processamento entre VMs, o sistema principal precisa ter delete seguro, status confiavel e falhas bem tratadas.

## Otimizacoes ASR Implementadas

Estado de codigo local em 2026-05-21:

- `POST /v1/transcribe-file`: microservico recebe audio por multipart, transcreve e apaga temporarios.
- Pre-warm: `NODE_PREWARM=true` carrega o modelo no startup para evitar primeira execucao lenta.
- Concorrencia: `NODE_MAX_CONCURRENT=1` protege a GPU contra jobs simultaneos e OOM.
- Cache: `NODE_CACHE_ENABLED=true` salva transcricoes por hash do arquivo/URL + parametros ASR.
- Normalizacao: suportada por `NODE_NORMALIZE_AUDIO=true`, mas desativada no Turbo INT8 porque o teste real ficou mais lento.
- Worker: tenta upload do `audio.mp3` extraido localmente antes de qualquer fallback por URL.
- Fallback: se a VM GPU falhar, o worker usa ASR local/API atual; fallback por URL remoto so entra com `REMOTE_ACCEL_ALLOW_URL_FALLBACK=true`.
- Metricas: migration `20260521030000_add_asr_metrics` adiciona campos de modelo, compute type, device, tempos, RTF, cache e fallback na tabela `Transcript`.
- Teste real por upload: com normalizacao ligada, `total_sec=51.057`; com normalizacao desligada, `total_sec=24.173` no mesmo audio de ~455s.

Comandos para ativar na VM GPU quando houver acesso SSH:

```bash
scp -i /home/ia/.ssh/id_node_agent -P 22563 tmp/node_agent_remote/app.py root@168.194.15.42:/home/ajustconsulting/projeto_enok_microservicos/node_agent/app.py
ssh -i /home/ia/.ssh/id_node_agent -p 22563 root@168.194.15.42 'cd /home/ajustconsulting/projeto_enok_microservicos/node_agent && python3 -m py_compile app.py && grep -q "^NODE_PREWARM=" .env && sed -i "s/^NODE_PREWARM=.*/NODE_PREWARM=true/" .env || echo NODE_PREWARM=true >> .env; grep -q "^NODE_CACHE_ENABLED=" .env && sed -i "s/^NODE_CACHE_ENABLED=.*/NODE_CACHE_ENABLED=true/" .env || echo NODE_CACHE_ENABLED=true >> .env; grep -q "^NODE_MAX_CONCURRENT=" .env && sed -i "s/^NODE_MAX_CONCURRENT=.*/NODE_MAX_CONCURRENT=1/" .env || echo NODE_MAX_CONCURRENT=1 >> .env; grep -q "^NODE_COMPUTE_TYPE=" .env && sed -i "s/^NODE_COMPUTE_TYPE=.*/NODE_COMPUTE_TYPE=int8/" .env || echo NODE_COMPUTE_TYPE=int8 >> .env; systemctl restart node-agent.service; sleep 4; systemctl is-active node-agent.service; curl -sS http://127.0.0.1:9873/health'
```

Comando para aplicar migration local:

```bash
corepack pnpm --filter @viralforge/database exec prisma migrate deploy --schema prisma/schema.prisma
```

Se o engine do Prisma falhar na VM principal, aplique o SQL direto:

```bash
psql "$DATABASE_URL" -f packages/database/prisma/migrations/20260521030000_add_asr_metrics/migration.sql
```
