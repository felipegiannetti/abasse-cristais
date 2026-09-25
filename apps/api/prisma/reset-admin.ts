import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// Recuperação de acesso: define uma senha temporária nova, destrava a conta,
// invalida sessões ativas e força a troca no próximo login.
// Uso: ADMIN_USERNAME=admin npm run admin:reset
async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user) {
    console.error(`Admin "${username}" não encontrado. Rode o seed primeiro (npm run db:seed).`);
    process.exitCode = 1;
    return;
  }

  const password = randomBytes(15).toString('base64url');
  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, 12),
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log(`Nova senha temporária para "${username}" (exibida só uma vez): ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
