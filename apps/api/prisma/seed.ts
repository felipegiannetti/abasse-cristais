import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// Cria o usuário admin padrão SE ele ainda não existir (nunca sobrescreve).
// A senha inicial é temporária: o admin é forçado a trocá-la no primeiro login.
async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" já existe — nada a fazer.`);
    return;
  }

  // Never fall back to a fixed password (it would be public in the repository): if none is provided,
  // generate a random one, in every environment.
  let password = process.env.ADMIN_INITIAL_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(15).toString('base64url');
    generated = true;
  }

  await prisma.adminUser.create({
    data: {
      username,
      passwordHash: await hash(password, 12),
      mustChangePassword: true,
    },
  });

  console.log(`Admin "${username}" criado. A senha deve ser trocada no primeiro login.`);
  if (generated) {
    console.log(`Senha temporária (exibida só uma vez): ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
