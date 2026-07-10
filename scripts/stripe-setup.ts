/**
 * stripe-setup.ts
 *
 * Cria os produtos e preços no Stripe e imprime os IDs para o .env.
 *
 * Uso:
 *   STRIPE_SECRET_KEY=sk_live_... tsx scripts/stripe-setup.ts
 *
 * O script é idempotente: se os produtos já existirem (detectado pelo metadata),
 * reutiliza os existentes em vez de criar duplicatas.
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('\nErro: STRIPE_SECRET_KEY não definida.\n');
  console.error('Execute: STRIPE_SECRET_KEY=sk_live_... tsx scripts/stripe-setup.ts\n');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ---- Definição dos planos ----

const PLANS = [
  {
    key: 'STRIPE_PRICE_PRO',
    productName: 'ViralForge Pro',
    productDescription: 'Para criadores de conteúdo ativos. 50 projetos/mês, 600 min, 200 renders.',
    unitAmount: 4900,   // R$ 49,00 em centavos
    currency: 'brl',
    interval: 'month' as const,
    metadata: { viralforge_plan: 'pro' },
  },
  {
    key: 'STRIPE_PRICE_STUDIO',
    productName: 'ViralForge Studio',
    productDescription: 'Para estúdios e times. 500 projetos/mês, 6000 min, 2000 renders.',
    unitAmount: 14900,  // R$ 149,00 em centavos
    currency: 'brl',
    interval: 'month' as const,
    metadata: { viralforge_plan: 'studio' },
  },
];

// ---- Helpers ----

async function findExistingPrice(planKey: string): Promise<string | null> {
  const prices = await stripe.prices.list({ limit: 100, expand: ['data.product'] });
  for (const price of prices.data) {
    const product = price.product as Stripe.Product;
    if (
      price.active &&
      price.recurring?.interval === 'month' &&
      product.metadata?.viralforge_plan === planKey
    ) {
      return price.id;
    }
  }
  return null;
}

async function createPlanPrice(plan: (typeof PLANS)[number]): Promise<string> {
  // Verifica se já existe um preço com esse metadata
  const existing = await findExistingPrice(plan.metadata.viralforge_plan);
  if (existing) {
    console.log(`  ↩  ${plan.productName}: preço existente reutilizado (${existing})`);
    return existing;
  }

  // Cria o produto
  const product = await stripe.products.create({
    name: plan.productName,
    description: plan.productDescription,
    metadata: plan.metadata,
  });

  // Cria o preço recorrente
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.unitAmount,
    currency: plan.currency,
    recurring: { interval: plan.interval },
    metadata: plan.metadata,
  });

  console.log(`  ✓  ${plan.productName}: produto ${product.id} / preço ${price.id}`);
  return price.id;
}

// ---- Main ----

async function main() {
  const isLive = STRIPE_SECRET_KEY!.startsWith('sk_live_');

  console.log('');
  console.log('================================================================');
  console.log(' ViralForge — Setup Stripe');
  console.log(` Ambiente: ${isLive ? 'PRODUÇÃO (live)' : 'TESTE (test)'}`);
  console.log('================================================================');
  console.log('');

  if (isLive) {
    console.log('⚠️  Você está usando uma chave LIVE. Os produtos serão criados em produção.');
    console.log('   Pressione Ctrl+C nos próximos 5 segundos para cancelar...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('');
  }

  console.log('Criando produtos e preços...\n');

  const results: Record<string, string> = {};

  for (const plan of PLANS) {
    const priceId = await createPlanPrice(plan);
    results[plan.key] = priceId;
  }

  // ---- Output ----

  console.log('');
  console.log('================================================================');
  console.log(' Adicione estas linhas ao seu .env:');
  console.log('================================================================');
  console.log('');

  for (const [key, value] of Object.entries(results)) {
    console.log(`${key}=${value}`);
  }

  console.log('');
  console.log('================================================================');
  console.log(' Variáveis completas de billing para o .env:');
  console.log('================================================================');
  console.log('');
  console.log(`STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}`);
  console.log('STRIPE_WEBHOOK_SECRET=whsec_...   # obtenha no Stripe Dashboard → Webhooks');
  for (const [key, value] of Object.entries(results)) {
    console.log(`${key}=${value}`);
  }

  console.log('');
  console.log('================================================================');
  console.log(' Próximos passos:');
  console.log('================================================================');
  console.log('');
  console.log('1. Copie as variáveis acima para o seu .env');
  console.log('');
  console.log('2. Configure o webhook no Stripe Dashboard:');
  console.log('   → Developers → Webhooks → Add endpoint');
  console.log(`   → URL: https://SEU_DOMINIO/api/billing/webhook`);
  console.log('   → Eventos:');
  console.log('       checkout.session.completed');
  console.log('       customer.subscription.updated');
  console.log('       customer.subscription.deleted');
  console.log('       invoice.payment_failed');
  console.log('');
  console.log('3. Copie o "Signing secret" do webhook e adicione ao .env como STRIPE_WEBHOOK_SECRET');
  console.log('');
  console.log('4. Reinicie a API:');
  console.log('   docker compose -f infra/docker-compose.prod.yml restart api');
  console.log('');
}

main().catch((err) => {
  console.error('\nErro durante setup do Stripe:', err.message);
  process.exit(1);
});
