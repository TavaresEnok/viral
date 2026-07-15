# API pública ViralForge

A API usa a chave criada em **Conta → API keys** no header `x-api-key`. Todos os projetos permanecem isolados pelo proprietário da chave e consomem as mesmas quotas do produto web.

## Criar e processar um projeto

```bash
curl -X POST https://seu-dominio.com/api/v1/projects \
  -H 'content-type: application/json' \
  -H 'x-api-key: viralforge_SUA_CHAVE' \
  -d '{
    "title": "Podcast semanal",
    "sourceUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "language": "pt-BR",
    "contentType": "PODCAST",
    "clipStyle": "VIRAL",
    "preferredClipDuration": 45,
    "renderLayout": "SMART_REFRAME",
    "captionTheme": "KARAOKE_PRO"
  }'
```

O retorno inicial tem status `PENDING`. Consulte o projeto até `COMPLETED` ou `FAILED`:

```bash
curl https://seu-dominio.com/api/v1/projects/PROJECT_ID \
  -H 'x-api-key: viralforge_SUA_CHAVE'
```

## Listar os cortes

```bash
curl https://seu-dominio.com/api/v1/projects/PROJECT_ID/clips \
  -H 'x-api-key: viralforge_SUA_CHAVE'
```

## Repetir ou excluir

```bash
curl -X POST https://seu-dominio.com/api/v1/projects/PROJECT_ID/retry \
  -H 'x-api-key: viralforge_SUA_CHAVE'

curl -X DELETE https://seu-dominio.com/api/v1/projects/PROJECT_ID \
  -H 'x-api-key: viralforge_SUA_CHAVE'
```

O endpoint de criação aceita links HTTPS do YouTube, incluindo Shorts e `youtu.be`. Upload binário, webhooks de conclusão e endpoints de render/publicação fazem parte da próxima versão da API.

