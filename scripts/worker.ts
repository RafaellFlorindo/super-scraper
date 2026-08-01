/**
 * Worker de fila. Um processo, um job por vez — suficiente para uso pessoal e
 * evita estourar cota de free tier.
 *   npm run worker
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { HANDLERS } from "../src/workers/handlers.js";

const MAX_ATTEMPTS = 3;
const POLL_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = true;
process.on("SIGINT", () => {
  console.log("\n  Encerrando após o job atual...");
  running = false;
});

/**
 * Job que ficou em "running" é órfão de um worker que morreu no meio: ninguém
 * mais vai terminá-lo, e ele nunca sai desse estado sozinho. Como só existe um
 * worker por vez, tudo que estiver "running" na largada é lixo de execução
 * anterior e pode voltar para a fila com segurança.
 */
const { count: recuperados } = await db.job.updateMany({
  where: { status: "running" },
  data: { status: "pending", runAfter: new Date() },
});
if (recuperados) console.log(`  ${recuperados} job(s) órfãos devolvidos à fila.`);

console.log("  Worker ativo. Ctrl+C para parar.\n");

while (running) {
  await db.workerHeartbeat.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: { beatAt: new Date() },
  });

  const job = await db.job.findFirst({
    where: { status: "pending", runAfter: { lte: new Date() } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  if (!job) {
    await sleep(POLL_MS);
    continue;
  }

  await db.job.update({ where: { id: job.id }, data: { status: "running" } });
  const handler = HANDLERS[job.kind];

  try {
    if (!handler) throw new Error(`job desconhecido: ${job.kind}`);
    await handler(JSON.parse(job.payload));
    await db.job.update({ where: { id: job.id }, data: { status: "done" } });
    console.log(`  ✓ ${job.kind}`);
  } catch (e) {
    const message = (e as Error).message;
    // 429 é cota, não defeito: não gasta tentativa, só espera mais.
    const rateLimited = message.includes("429");
    const attempts = rateLimited ? job.attempts : job.attempts + 1;
    const dead = attempts >= MAX_ATTEMPTS;
    await db.job.update({
      where: { id: job.id },
      data: {
        status: dead ? "failed" : "pending",
        attempts,
        error: message.slice(0, 500),
        // backoff exponencial: 5s, 25s, ... e 60s fixo quando é cota
        runAfter: new Date(Date.now() + (rateLimited ? 60_000 : 5000 * attempts ** 2)),
      },
    });
    console.error(
      rateLimited
        ? `  ⏳ ${job.kind}: cota estourada, tentando de novo em 60s`
        : `  ✗ ${job.kind} (${attempts}/${MAX_ATTEMPTS}): ${message.slice(0, 160)}`
    );
  }
}

await db.$disconnect();
