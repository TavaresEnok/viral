import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('viralforge123', 12);

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
