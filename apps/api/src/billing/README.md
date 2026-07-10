# Billing Module

Módulo responsável pela integração com Stripe para gerenciamento de assinaturas e billing.

## Configuração

As seguintes variáveis de ambiente devem estar configuradas:

```env
STRIPE_SECRET_KEY=sk_live_... (ou sk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_STUDIO=price_...
WEB_ORIGIN=https://seu-dominio.com
```

## Endpoints

### POST /billing/checkout
**Autenticado**

Cria uma sessão de checkout do Stripe para compra de assinatura.

**Request:**
```json
{
  "planId": "pro" // ou "studio"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/..."
}
```

### POST /billing/portal
**Autenticado**

Abre o portal de gerenciamento de assinatura do cliente no Stripe.

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

### GET /billing/status
**Autenticado**

Retorna o status da assinatura do usuário.

**Response:**
```json
{
  "plan": "pro",
  "status": "active",
  "subscriptionId": "sub_...",
  "customerId": "cus_..."
}
```

### POST /billing/cancel
**Autenticado**

Cancela a assinatura do usuário e o rebaixa para o plano Free.

**Response:**
```json
{
  "success": true
}
```

### POST /billing/webhook
**Sem autenticação**

Webhook do Stripe para sincronizar eventos de assinatura. Deve ser configurado no dashboard do Stripe.

## Fluxo de Assinatura

1. **Usuário clica em "Upgrade"**
   - Frontend chama `POST /billing/checkout` com o plano desejado
   - API retorna URL de checkout do Stripe
   - Usuário é redirecionado para o Stripe Checkout

2. **Usuário completa o pagamento**
   - Stripe dispara `checkout.session.completed`
   - Webhook recebe e sincroniza assinatura
   - UserQuota é atualizado com novo plano e limites

3. **Gerenciar assinatura**
   - Usuário pode acessar portal de billing via `POST /billing/portal`
   - Mudar plano ou cancelar assinatura
   - Eventos do Stripe atualizam UserQuota em tempo real

## Eventos de Webhook

O módulo está configurado para lidar com os seguintes eventos:

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Ativa assinatura e atualiza plano |
| `customer.subscription.updated` | Sincroniza status da assinatura |
| `customer.subscription.deleted` | Rebaixa para Free |
| `invoice.payment_failed` | Registra falha de pagamento em logs |

## Planos Disponíveis

```javascript
const PLANS = {
  free: {
    // Sem price ID, plano gratuito
    quotas: { 
      maxProjectsPerMonth: 5, 
      maxProjectMinutesPerMonth: 60, 
      maxRendersPerMonth: 20 
    }
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO,
    quotas: { 
      maxProjectsPerMonth: 50, 
      maxProjectMinutesPerMonth: 600, 
      maxRendersPerMonth: 200 
    }
  },
  studio: {
    priceId: process.env.STRIPE_PRICE_STUDIO,
    quotas: { 
      maxProjectsPerMonth: 500, 
      maxProjectMinutesPerMonth: 6000, 
      maxRendersPerMonth: 2000 
    }
  }
};
```

## Integração com QuotaModule

O BillingModule atualiza a tabela `UserQuota` com os limites do plano. O `QuotaModule` utiliza esses valores para validar se o usuário pode criar projetos, fazer renders, etc.

### Fluxo de Atualização de Quotas

1. Webhook do Stripe notifica mudança de assinatura
2. `StripeWebhookHandler` valida e atualiza `UserQuota`
3. `QuotaModule` consulta `UserQuota.maxProjectsPerMonth` ao validar quota de projetos
4. Usuário só consegue criar/renderizar se não exceder limite

## Observações Importantes

- O campo `currentPeriodEnd` está reservado para implementação futura (armazenar fim do período de cobrança)
- Cancelamento de assinatura rebaixa automaticamente para o plano Free
- Falhas de pagamento são registradas em logs, mas não cancelam automaticamente (política do Stripe)
- O portal do Stripe é gerenciado via variáveis de ambiente configuradas na dashboard do Stripe

## Testes

Para testar em desenvolvimento:

1. Use credentials de teste do Stripe (sk_test_...)
2. Use o webhook signing secret de teste
3. Use cartões de teste: `4242 4242 4242 4242` (sucesso), `4000 0000 0000 0002` (falha)

Para simular webhooks localmente:
```bash
stripe listen --forward-to localhost:3001/billing/webhook
```
