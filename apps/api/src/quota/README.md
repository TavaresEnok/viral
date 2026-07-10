# Sistema de Quotas/Limites - ViralForge

## Visão Geral

O sistema de quotas implementa limites de uso para usuários baseado em planos de subscrição. Controla:
- Número máximo de projetos por mês
- Minutos de processamento de vídeo por mês
- Número de renders de clips por mês

## Planos Disponíveis

### FREE
- Máximo 5 projetos/mês
- Máximo 60 minutos de processamento/mês
- Máximo 20 renders/mês
- Máximo 10 clips

### PRO
- Máximo 50 projetos/mês
- Máximo 600 minutos de processamento/mês
- Máximo 200 renders/mês
- Máximo 100 clips

### STUDIO
- Máximo 500 projetos/mês
- Máximo 6000 minutos de processamento/mês
- Máximo 2000 renders/mês
- Máximo 500 clips

## Arquitetura

### QuotaService (`quota.service.ts`)

Serviço responsável por gerenciar e validar quotas:

#### Métodos de Validação
- `checkClipRenderQuota(userId, durationSeconds?)`: boolean - Verifica se usuário pode fazer render
- `checkProjectQuota(userId)`: boolean - Verifica se usuário pode criar projeto
- `ensureCanRender(userId)`: void - Lança ForbiddenException se limite foi atingido
- `ensureCanProcessProject(userId)`: void - Lança ForbiddenException se limite foi atingido

#### Métodos de Consumo
- `consumeProjectMinutes(userId, minutes)`: void - Incrementa minutos usados
- `consumeClipRender(userId)`: void - Incrementa renders usados
- `registerMinutesUsed(userId, minutes)`: void - Alias para consumeProjectMinutes
- `registerRender(userId)`: void - Alias para consumeClipRender

#### Métodos de Informação
- `getRemainingQuota(userId)`: Promise<QuotaInfo> - Retorna quotas restantes
- `getQuota(userId)`: Promise<QuotaInfo> - Retorna informações formatadas de quota
- `resetMonthlyQuotaIfNeeded(userId)`: Promise<boolean> - Reseta quotas se novo mês começou

### PlanoS (`plans.ts`)

Define os limites para cada plano:

```typescript
interface QuotaPlan {
  maxProjects: number;
  maxMinutes: number;
  maxRenders: number;
  maxClips: number;
}

function getPlanLimits(planName: string): QuotaPlan
```

### QuotaController (`quota.controller.ts`)

Endpoints HTTP:
- `GET /quota` - Retorna status de quota atual do usuário autenticado
- `GET /users/me/quota` - Retorna quotas restantes do usuário autenticado

## Fluxo de Integração

### 1. Criar Projeto (POST /projects)
```typescript
// No ProjectsService.create()
await this.quotaService.ensureCanProcessProject(userId);
// Lança ForbiddenException se limite foi atingido
```

### 2. Upload/Submit de Vídeo
```typescript
// No ProjectsService.attachUpload() e attachYoutubeUrl()
await this.quotaService.ensureCanProcessProject(userId);
```

### 3. Fazer Render de Clip (POST /clips/:id/render)
```typescript
// No ClipsService.render()
await this.quotaService.ensureCanRender(userId);
// Lança ForbiddenException se limite foi atingido
```

### 4. Registrar Render Concluído
```typescript
// No VideoProcessorService (worker) quando clip é concluído
await this.registerQuotaRender(userId);
// Incrementa monthlyRenders
```

## Reset Mensal

As quotas são resetadas automaticamente no primeiro dia do mês quando:
1. Usuário acessa qualquer endpoint que chama `ensureAndReset()`
2. O método detecta que `monthlyResetAt < 1º do mês atual`
3. Reseta `monthlyProjectMinutes` e `monthlyRenders` para 0

Para forçar reset em um cron job:
```typescript
await this.quotaService.resetMonthlyQuotaIfNeeded(userId);
```

## Schema do Banco de Dados

```prisma
model UserQuota {
  userId                    String   @id
  user                      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                      String   @default("free")
  monthlyProjectMinutes     Float    @default(0)
  monthlyRenders            Int      @default(0)
  monthlyResetAt            DateTime @default(now())
  maxProjectMinutesPerMonth Float    @default(60)
  maxRendersPerMonth        Int      @default(20)
  maxProjectsPerMonth       Int      @default(5)
  stripeSubscriptionId      String?  @unique
  stripeCustomerId          String?
  subscriptionStatus        String   @default("inactive")
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}
```

## Resposta de API

### GET /users/me/quota
```json
{
  "remainingRenders": 15,
  "remainingMinutes": 30,
  "remainingProjects": 3,
  "plan": "free",
  "resetAt": "2025-02-01T00:00:00Z"
}
```

### GET /quota
```json
{
  "plan": "free",
  "projectsUsed": 2,
  "projectsLimit": 5,
  "minutesUsed": 30,
  "minutesLimit": 60,
  "rendersUsed": 5,
  "rendersLimit": 20,
  "resetAt": "2025-02-01T00:00:00Z"
}
```

## Erros

Quando limite é atingido, a API retorna:

```json
{
  "statusCode": 403,
  "message": "Você atingiu o limite de 20 renders/mês no plano free.",
  "error": "Forbidden"
}
```

## Testes

Execute os testes com:
```bash
pnpm test quota.service.spec.ts
```

## Futuros Aprimoramentos

- [ ] Endpoint para upgrade de plano
- [ ] Webhook do Stripe para sincronizar planos
- [ ] Metrics de uso por período
- [ ] Alertas quando atingir 80% da quota
- [ ] Histórico de consumo de quotas
