/**
 * Reaplica a prioridade por tipo em toda a fila e ressuscita os jobs de
 * transcrição que ficaram marcados como "done" sem terem transcrito nada.
 *
 *   npm run bump
 *
 * Necessário depois de mudar a tabela PRIORITY, ou para consertar uma fila
 * criada por uma versão antiga do código.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const PRIORITY: Record<string, number> = {
  mine: 10,
  media: 8,
  transcribe: 8,
  enrich: 2,
  funnel: 1,
};

for (const [kind, priority] of Object.entries(PRIORITY)) {
  const { count } = await db.job.updateMany({
    where: { kind, status: { in: ["pending", "failed"] } },
    data: { priority },
  });
  if (count) console.log(`  ${kind.padEnd(11)} ${count} jobs -> prioridade ${priority}`);
}

// Transcrições que "passaram" sem chave do Groq: o código antigo retornava em
// silêncio e o job virava done. Nenhuma delas transcreveu nada.
const fantasmas = await db.job.findMany({ where: { kind: "transcribe", status: "done" } });
const revividos: string[] = [];
for (const job of fantasmas) {
  const { creativeId } = JSON.parse(job.payload) as { creativeId: string };
  const creative = await db.creative.findUnique({ where: { id: creativeId } });
  if (creative && !creative.transcript) {
    await db.job.update({
      where: { id: job.id },
      data: { status: "pending", attempts: 0, error: null, priority: 8, runAfter: new Date() },
    });
    revividos.push(creativeId);
  }
}

// vídeos baixados que nunca ganharam job de transcrição
const orfaos = await db.creative.findMany({
  where: { kind: "video", localPath: { not: null }, transcript: null },
  select: { id: true },
});
const jaTem = new Set(
  (await db.job.findMany({ where: { kind: "transcribe" }, select: { payload: true } })).map(
    (j) => JSON.parse(j.payload).creativeId as string
  )
);
let criados = 0;
for (const c of orfaos) {
  if (jaTem.has(c.id)) continue;
  await db.job.create({
    data: { kind: "transcribe", payload: JSON.stringify({ creativeId: c.id }), priority: 8 },
  });
  criados++;
}

console.log(
  `\n  ${revividos.length} transcrições falsas revividas, ${criados} criadas do zero.\n`
);
await db.$disconnect();
