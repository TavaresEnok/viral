/**
 * Promove (ou revoga) um usuário a administrador do painel.
 *
 * Uso:
 *   tsx scripts/make-admin.ts <email>            # concede admin
 *   tsx scripts/make-admin.ts <email> --revoke   # revoga admin
 *
 * Ou via pnpm:
 *   corepack pnpm admin:grant <email>
 */
import { PrismaClient } from '@viralforge/database';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');

  if (!email) {
    console.error('Uso: tsx scripts/make-admin.ts <email> [--revoke]');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { isAdmin: !revoke },
    select: { email: true, name: true, isAdmin: true },
  });

  console.log(
    `${updated.isAdmin ? '✔ Admin concedido' : '✔ Admin revogado'}: ${updated.name} <${updated.email}>`,
  );
  console.log('O usuário precisa fazer login novamente para o menu Admin aparecer.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
