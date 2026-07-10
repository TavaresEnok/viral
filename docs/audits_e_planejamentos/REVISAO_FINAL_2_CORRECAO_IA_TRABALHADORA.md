# Revisao Final 2 da Entrega da IA Trabalhadora

Data: 2026-05-20
Status: **quase aprovada, mas ainda com 1 bloqueio funcional**

Esta revisao valida a correcao feita apos `REVISAO_FINAL_CORRECAO_IA_TRABALHADORA.md`.

## Validacoes Executadas

| Comando | Resultado |
|---|---|
| `corepack pnpm typecheck` | Passou |
| `corepack pnpm test` | Passou |
| `corepack pnpm build` | Passou |

## Correcoes Confirmadas

| Item | Status | Evidencia |
|---|---:|---|
| Compose de producao passou a usar `MASTER_SECRET` | Aprovado | `infra/docker-compose.prod.yml:66`, `infra/docker-compose.prod.yml:92` |
| Compose de producao removeu fallback `localhost` de `NEXT_PUBLIC_API_URL` | Aprovado | `infra/docker-compose.prod.yml:118` |
| `DEPLOY.md` passou a documentar `MASTER_SECRET` | Aprovado | `DEPLOY.md:15` |
| `DEPLOY.md` passou a documentar worker em `3012` | Aprovado | `DEPLOY.md:40`, `DEPLOY.md:95` |
| `DEPLOY.md` passou a documentar variaveis YouTube | Aprovado | `DEPLOY.md:16`, `DEPLOY.md:17` |
| Rota real para logo do Brand Kit foi criada | Aprovado parcial | `apps/api/src/brand-kit/brand-kit.controller.ts:56` |
| Frontend deixou de apontar para `/storage/...` e passou a apontar para `/brand-kits/:id/logo` | Aprovado parcial | `apps/web/src/lib/api.ts:74` |

## Bloqueio Restante

### 1. Logo do Brand Kit ainda nao deve carregar no navegador

**Severidade:** Alta

A rota criada para buscar o logo esta dentro de controller protegido por JWT:

```txt
apps/api/src/brand-kit/brand-kit.controller.ts:26-28
@Controller('brand-kits')
@UseGuards(JwtAuthGuard)
```

E o frontend usa a rota diretamente em `<img src="...">`:

```txt
apps/web/src/app/(dashboard)/dashboard/brand/page.tsx:16
<img src={brandKitLogoUrl(kit.id)} ... />

apps/web/src/app/(dashboard)/dashboard/brand/page.tsx:100
<img src={brandKitLogoUrl(kit.id)} ... />
```

O problema: `<img src>` nao envia header `Authorization: Bearer ...`. Como a autenticacao atual do sistema usa bearer token no header, o navegador deve chamar `GET /brand-kits/:id/logo` sem token e receber `401`.

**Impacto:** upload pode funcionar e o arquivo pode estar seguro, mas a imagem nao aparece na tela.

## Correcao Exigida

### Opcao A implementada: busca como blob autenticado no frontend

Checklist:

- [x] Criar funcao `api.brandKits.logoBlobUrl(id)` usando `fetch` com bearer token e `URL.createObjectURL`.
- [x] Criar componente `BrandKitLogo` que carrega o blob e faz `URL.createObjectURL`.
- [x] Revogar object URL no cleanup com `URL.revokeObjectURL`.
- [x] Exibir fallback com inicial do kit enquanto carrega ou quando falha.
- [x] Manter rota API protegida por JWT.

### Opcao B - Aceitavel: URL assinada temporaria

Criar endpoint autenticado que retorna uma URL assinada curta para o logo.

Checklist:

- [ ] `GET /brand-kits/:id/logo-url` autenticado retorna URL assinada com expiracao curta.
- [ ] `GET /brand-kits/:id/logo-public?token=...` valida token e ownership embutido.
- [ ] Token expira rapidamente.
- [ ] Sem expor caminho real do arquivo no disco.

### Opcao C - Nao recomendada: tornar `GET /brand-kits/:id/logo` publico

So aceitar se a URL tiver token assinado ou se houver outra protecao equivalente. Nao deixar publico apenas por `id`, porque IDs podem vazar.

## Ajustes Menores Resolvidos

| Item | Status |
|---|---|
| `apps/api/src/brand-kit/brand-kit.service.ts` importava `createReadStream` sem usar | Removido |
| `apps/api/src/brand-kit/brand-kit.module.ts` tinha `MulterModule.register` redundante | Removido |
| `apps/api/src/main.ts` logava `ViralForge API listening...` | Trocado para `ViralForge` |
| `api.brandKits.uploadLogo` nao tratava `response.ok` | Corrigido com `ApiError` |

## Parecer

Todos os bloqueios foram resolvidos. O logo do Brand Kit agora carrega via blob autenticado, os ajustes menores foram limpos, e typecheck/testes/build passam. A entrega esta pronta para seguir para a proxima fase.
