/**
 * Worker de fila. Várias "raias" concorrentes puxando job por job — antes era
 * uma raia só, então um job pesado (Playwright, render de vídeo) enfileirava
 * atrás de si toda a mineração/mídia pendente. WORKER_CONCURRENCY controla
 * quantas raias sobem (padrão 3); ajuste pra baixo se a máquina/VPS for fraca.
 *   npm run worker
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { HANDLERS } from "../src/workers/handlers.js";

const MAX_ATTEMPTS = 3;
const POLL_MS = 2000;
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = true;
process.on("SIGINT", () => {
  console.log("\n  Encerrando após os jobs em andamento...");
  running = false;
});

/**
 * Job que ficou em "running" é órfão de um worker que morreu no meio: ninguém
 * mais vai terminá-lo, e ele nunca sai desse estado sozinho. Como o processo
 * inteiro reinicia do zero, tudo que estiver "running" na largada é lixo de
 * execução anterior e pode voltar para a fila com segurança.
 */
const { count: recuperados } = await db.job.updateMany({
  where: { status: "running" },
  data: { status: "pending", runAfter: new Date() },
});
if (recuperados) console.log(`  ${recuperados} job(s) órfãos devolvidos à fila.`);

console.log(`  Worker ativo (${CONCURRENCY} raias). Ctrl+C para parar.\n`);

/**
 * Pega um job pendente e já marca como "running" dentro da mesma transação:
 * com várias raias chamando isto ao mesmo tempo, sem isso duas raias podiam
 * pegar o mesmo job entre o "achar" e o "marcar".
 */
async function claimJob() {
  return db.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { status: "pending", runAfter: { lte: new Date() } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    if (!job) return null;
    await tx.job.update({ where: { id: job.id }, data: { status: "running" } });
    return job;
  });
}

async function runOne(job: Awaited<ReturnType<typeof claimJob>> & {}) {
  const handler = HANDLERS[job!.kind];
  try {
    if (!handler) throw new Error(`job desconhecido: ${job!.kind}`);
    await handler(JSON.parse(job!.payload));
    await db.job.update({ where: { id: job!.id }, data: { status: "done" } });
    console.log(`  ✓ ${job!.kind}`);
  } catch (e) {
    const message = (e as Error).message;
    // 429 é cota, não defeito: não gasta tentativa, só espera mais.
    const rateLimited = message.includes("429");
    const attempts = rateLimited ? job!.attempts : job!.attempts + 1;
    const dead = attempts >= MAX_ATTEMPTS;
    await db.job.update({
      where: { id: job!.id },
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
        ? `  ⏳ ${job!.kind}: cota estourada, tentando de novo em 60s`
        : `  ✗ ${job!.kind} (${attempts}/${MAX_ATTEMPTS}): ${message.slice(0, 160)}`
    );
  }
}

async function lane() {
  while (running) {
    const job = await claimJob();
    if (!job) {
      await sleep(POLL_MS);
      continue;
    }
    await runOne(job);
  }
}

async function heartbeat() {
  while (running) {
    await db.workerHeartbeat.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: { beatAt: new Date() },
    });
    await sleep(POLL_MS);
  }
}

await Promise.all([heartbeat(), ...Array.from({ length: CONCURRENCY }, lane)]);
await db.$disconnect();
