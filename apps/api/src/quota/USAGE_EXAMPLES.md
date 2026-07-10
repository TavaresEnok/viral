# Exemplos de Uso - Sistema de Quotas

## 1. Verificar Quotas Restantes do Usuário

### Frontend - Requisição HTTP
```bash
GET /users/me/quota
Authorization: Bearer <token>
```

### Resposta
```json
{
  "remainingRenders": 15,
  "remainingMinutes": 30,
  "remainingProjects": 3,
  "plan": "free",
  "resetAt": "2025-02-01T00:00:00Z"
}
```

### Frontend - Exemplo TypeScript
```typescript
async function getUserQuota() {
  const response = await fetch('/users/me/quota', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const quota = await response.json();
  
  if (quota.remainingProjects === 0) {
    showError('Você atingiu o limite de projetos. Upgrade seu plano!');
  }
}
```

## 2. Criar um Projeto (Com Validação de Quota)

### Requisição HTTP
```bash
POST /projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Meu Novo Projeto",
  "language": "pt-BR",
  "contentType": "PODCAST",
  "clipStyle": "VIRAL",
  "preferredClipDuration": 45
}
```

### Fluxo no Backend
```typescript
// projects.controller.ts
@Post()
create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
  return this.projectsService.create(user.id, dto);
}

// projects.service.ts
async create(userId: string, dto: CreateProjectDto) {
  // Validação automática - lança ForbiddenException se necessário
  await this.quotaService.ensureCanProcessProject(userId);
  
  // Cria o projeto se passou na validação
  const project = await this.prisma.project.create({
    data: { /* ... */ }
  });
  
  return project;
}
```

### Erros Possíveis
```json
{
  "statusCode": 403,
  "message": "Você atingiu o limite de 5 projetos/mês no plano free.",
  "error": "Forbidden"
}
```

```json
{
  "statusCode": 403,
  "message": "Você atingiu o limite de 60 minutos processados/mês no plano free.",
  "error": "Forbidden"
}
```

## 3. Fazer Upload de Vídeo (Com Validação)

### Requisição HTTP
```bash
POST /projects/:projectId/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <video.mp4>
```

### Fluxo
```typescript
// projects.service.ts
async attachUpload(userId: string, projectId: string, originalFilePath: string) {
  const project = await this.ensureOwner(userId, projectId);
  
  // Validação de quota antes de aceitar o arquivo
  await this.quotaService.ensureCanProcessProject(userId);
  
  // Processa o upload
  const updated = await this.prisma.project.update({
    where: { id: projectId },
    data: {
      originalFilePath,
      status: ProjectStatus.PENDING,
      progress: 5
    }
  });
  
  // Enfileira para processamento
  await this.queueService.addVideoProcessingJob({
    projectId,
    userId,
    originalFilePath
  });
  
  return updated;
}
```

## 4. Fazer Render de Clip (Com Validação)

### Requisição HTTP
```bash
POST /clips/:clipId/render
Authorization: Bearer <token>
Content-Type: application/json

{
  "start": 10,
  "end": 55,
  "renderLayout": "BLURRED_BACKGROUND",
  "captionTheme": "CLEAN_FOOTER"
}
```

### Fluxo
```typescript
// clips.service.ts
async render(userId: string, clipId: string, dto: RenderClipDto) {
  const clip = await this.getOwnedClip(userId, clipId);
  
  // Validação - lança ForbiddenException se limite atingido
  await this.quotaService.ensureCanRender(userId);
  
  // Atualiza clip para status RENDERING
  await this.prisma.clip.update({
    where: { id: clipId },
    data: { status: 'RENDERING', errorMessage: null }
  });
  
  // Enfileira para render
  await this.queueService.addClipRenderJob({
    jobType: 'RENDER_CLIP',
    projectId: clip.projectId,
    userId,
    clipId
  });
  
  return this.getOwnedClip(userId, clipId);
}
```

### Erro - Limite Atingido
```json
{
  "statusCode": 403,
  "message": "Você atingiu o limite de 20 renders/mês no plano free.",
  "error": "Forbidden"
}
```

## 5. Worker - Registrar Render Concluído

### Fluxo no Worker
```typescript
// apps/worker/src/services/video-processor.service.ts
private async renderSingleClip(clip, paths) {
  // ... renderiza o clip ...
  
  // Atualiza status para COMPLETED
  await this.prisma.clip.update({
    where: { id: clip.id },
    data: {
      ...paths,
      status: "COMPLETED",
      errorMessage: null
    }
  });
  
  // Registra o consumo de quota
  await this.registerQuotaRender(payload.userId);
  
  // Continua processamento...
}

private async registerQuotaRender(userId: string) {
  const existing = await this.prisma.userQuota.findUnique({
    where: { userId }
  });
  
  if (existing) {
    // Incrementa render usado
    await this.prisma.userQuota.update({
      where: { userId },
      data: { monthlyRenders: { increment: 1 } }
    });
  }
}
```

## 6. Usar Serviço de Quota Diretamente

### No Backend - Verificação Simples
```typescript
constructor(private readonly quotaService: QuotaService) {}

async someMethod(userId: string) {
  // Verificar se pode fazer render (retorna boolean)
  const canRender = await this.quotaService.checkClipRenderQuota(userId);
  
  if (!canRender) {
    // Fazer algo
  }
}
```

### No Backend - Consumir Quota Manualmente
```typescript
async processVideo(userId: string, durationMinutes: number) {
  // Consome minutos de processamento
  await this.quotaService.consumeProjectMinutes(userId, durationMinutes);
}
```

### No Backend - Obter Informações Completas
```typescript
async showQuotaStatus(userId: string) {
  const quota = await this.quotaService.getRemainingQuota(userId);
  
  console.log(`
    Plano: ${quota.plan}
    Renders: ${quota.remainingRenders} disponíveis
    Minutos: ${quota.remainingMinutes} disponíveis
    Projetos: ${quota.remainingProjects} disponíveis
    Reset em: ${quota.resetAt.toLocaleDateString()}
  `);
}
```

## 7. Cron Job - Reset Mensal

### Implementação
```typescript
// apps/api/src/common/cron.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuotaService } from '../quota/quota.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class CronService {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly prisma: PrismaService
  ) {}

  // Executa no primeiro dia do mês às 00:00 UTC
  @Cron('0 0 1 * *')
  async resetMonthlyQuotas() {
    const users = await this.prisma.user.findMany();
    
    for (const user of users) {
      const wasReset = await this.quotaService.resetMonthlyQuotaIfNeeded(user.id);
      if (wasReset) {
        console.log(`Quota resetada para usuário ${user.id}`);
      }
    }
  }
}
```

## 8. Integração no Frontend - Dashboard

### React Component Example
```typescript
import { useEffect, useState } from 'react';

interface Quota {
  remainingRenders: number;
  remainingMinutes: number;
  remainingProjects: number;
  plan: string;
  resetAt: string;
}

export function QuotaDisplay() {
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    fetch('/users/me/quota')
      .then(r => r.json())
      .then(setQuota);
  }, []);

  if (!quota) return <div>Carregando...</div>;

  return (
    <div className="quota-card">
      <h3>Seu Plano: {quota.plan.toUpperCase()}</h3>
      
      <div className="quota-item">
        <label>Projetos</label>
        <progress max="5" value={5 - quota.remainingProjects} />
        <span>{5 - quota.remainingProjects}/5</span>
      </div>
      
      <div className="quota-item">
        <label>Minutos de Processamento</label>
        <progress max="60" value={60 - quota.remainingMinutes} />
        <span>{60 - quota.remainingMinutes}/60</span>
      </div>
      
      <div className="quota-item">
        <label>Renders</label>
        <progress max="20" value={20 - quota.remainingRenders} />
        <span>{20 - quota.remainingRenders}/20</span>
      </div>
      
      <p className="reset-date">
        Reseta em: {new Date(quota.resetAt).toLocaleDateString()}
      </p>
    </div>
  );
}
```

## 9. Testes Automatizados

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotaService } from './quota.service';

describe('QuotaService', () => {
  let service: QuotaService;
  
  beforeEach(() => {
    // Setup com mocks
    service = new QuotaService(mockPrisma);
  });

  it('deve bloquear render quando limite é atingido', async () => {
    const userId = 'user123';
    mockQuotaWithRenders(20); // Max do free plan
    
    expect(service.ensureCanRender(userId)).rejects.toThrow(
      'Você atingiu o limite de 20 renders/mês'
    );
  });

  it('deve permitir render quando quota disponível', async () => {
    const userId = 'user123';
    mockQuotaWithRenders(5); // Dentro do limite
    
    expect(service.ensureCanRender(userId)).resolves.not.toThrow();
  });
});
```
