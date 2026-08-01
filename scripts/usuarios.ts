/**
 * Gerencia contas pela linha de comando, útil quando você perde a senha.
 *
 *   npm run usuarios                                    lista
 *   npm run usuarios -- add email@x.com "Nome" senha    cria
 *   npm run usuarios -- senha email@x.com novasenha     troca a senha
 *   npm run usuarios -- rm email@x.com                  remove
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { criarUsuario, hashPassword } from "../src/lib/auth.js";

const [acao, ...args] = process.argv.slice(2);

if (acao === "add") {
  const [email, nome, senha] = args;
  if (!email || !nome || !senha) {
    console.error('\n  Uso: npm run usuarios -- add email@x.com "Nome" senha\n');
    process.exit(1);
  }
  const u = await criarUsuario({ email, name: nome, senha, role: "admin" });
  console.log(`\n  Criado: ${u.email}\n`);
} else if (acao === "senha") {
  const [email, senha] = args;
  if (!email || !senha) {
    console.error("\n  Uso: npm run usuarios -- senha email@x.com novasenha\n");
    process.exit(1);
  }
  await db.user.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash: hashPassword(senha) },
  });
  // derruba as sessões abertas: trocar senha precisa expulsar quem já estava
  await db.session.deleteMany({ where: { user: { email: email.toLowerCase() } } });
  console.log(`\n  Senha trocada e sessões encerradas para ${email}\n`);
} else if (acao === "rm") {
  const [email] = args;
  await db.user.delete({ where: { email: email.toLowerCase() } });
  console.log(`\n  Removido: ${email}\n`);
} else {
  const users = await db.user.findMany({
    include: { _count: { select: { sessions: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log();
  if (!users.length) console.log("  Nenhum usuário. O app vai abrir em /instalar.");
  for (const u of users) {
    console.log(
      `  ${u.role.padEnd(6)} ${u.email.padEnd(32)} ${u.name.padEnd(20)} ` +
        `${u._count.sessions} sessão(ões)`
    );
  }
  console.log();
}

await db.$disconnect();
