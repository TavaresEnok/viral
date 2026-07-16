import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Nunca semear produção: o seed cria uma conta conhecida e, se a senha for
  // fixa no repositório (público), a conta nasce aberta.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error(
      'Seed bloqueado em produção. Use ALLOW_PROD_SEED=true apenas se souber o que está fazendo.',
    );
  }

  // Senha nunca versionada: vem do ambiente ou é gerada e mostrada uma vez.
  const generated = !process.env.SEED_DEMO_PASSWORD;
  const password = process.env.SEED_DEMO_PASSWORD ?? randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  if (generated) {
    console.log(`\n  Usuário demo criado com senha aleatória: ${password}`);
    console.log('  Guarde agora — não será exibida de novo.\n');
  }

  await prisma.user.upsert({
    where: { email: 'demo@viralforge.local' },
    update: { name: 'Demo ViralForge', passwordHash },
    create: {
      name: 'Demo ViralForge',
      email: 'demo@viralforge.local',
      passwordHash,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
