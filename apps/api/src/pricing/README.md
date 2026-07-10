# Pricing Module

Módulo responsável pela exposição de informações de preços e planos.

## Endpoints

### GET /pricing

Retorna todos os tiers de preço disponíveis com detalhes de features e limites.

**Response:**
```json
{
  "free": {
    "id": "free",
    "name": "Free",
    "price": 0,
    "currency": "USD",
    "billingPeriod": "month",
    "description": "Perfect for getting started",
    "features": [...],
    "limits": {
      "maxProjects": 5,
      "maxMinutes": 60,
      "maxRenders": 20,
      "maxClips": 10
    }
  },
  "pro": { ... },
  "studio": { ... },
  "currency": "USD"
}
```

### GET /pricing/estimate?projectDurationMinutes=100&rendersCount=25

Estima o custo mensal baseado em uso.

**Query Parameters:**
- `projectDurationMinutes` (number): Duração total do projeto em minutos
- `rendersCount` (number): Número de renders

**Response:**
```json
{
  "cost": 3.50,
  "breakdown": {
    "projectMinutesPrice": 2.00,
    "rendersPrice": 1.50,
    "basePrice": 0
  }
}
```

## Pricing Tiers

| Plano | Preço | Projetos/mês | Minutos/mês | Renders/mês | Features |
|-------|-------|---|---|---|---|
| **Free** | $0 | 5 | 60 | 20 | Community support |
| **Pro** | $19 | 50 | 600 | 200 | Email support, Advanced tools |
| **Studio** | $99 | 500 | 6000 | 2000 | Priority support, Enterprise tools |

## Modelo de Cálculo de Custo

O modelo de custo utilizado para overage (uso além do plano gratuito) é:

- **Minutos adicionais**: $0.05 por minuto
- **Renders adicionais**: $0.20 por render

Os limites do plano Free são:
- 60 minutos de processamento
- 20 renders

Exemplo: Um usuário com 100 minutos e 25 renders custaria:
- Minutos: (100 - 60) × $0.05 = $2.00
- Renders: (25 - 20) × $0.20 = $1.00
- **Total: $3.00/mês**
