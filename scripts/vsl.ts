/**
 * Diagnóstico da cadeia de VSL: baixou? transcreveu? npm run vsl
 * Com --requeue, reenfileira o que ficou para trás.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const videos = await db.creative.count({ where: { kind: "video" } });
const baixados = await db.creative.count({ where: { kind: "video", localPath: { not: null } } });
const transcritos = await db.creative.count({ where: { transcript: { not: null } } });

console.log(`\n  vídeos no banco ....... ${videos}`);
console.log(`  já baixados ........... ${baixados}`);
console.log(`  já transcritos ........ ${transcritos}`);

// vídeo baixado, sem transcrição e sem job na fila = ficou órfão
const orfaos = await db.creative.findMany({
  where: { kind: "video", localPath: { not: null }, transcript: null },
  select: { id: true },
});

const comJob = new Set(
  (await db.job.findMany({ where: { kind: "transcribe" }, select: { payload: true } })).map(
    (j) => JSON.parse(j.payload).creativeId
  )
);
const semJob = orfaos.filter((c) => !comJob.has(c.id));

console.log(`  baixados sem transcrição ${orfaos.length}`);
console.log(`  destes, sem job na fila  ${semJob.length}`);

if (process.argv.includes("--requeue")) {
  // devolve os transcribe que "passaram" sem chave e cria os que faltam
  const reset = await db.job.updateMany({
    where: { kind: "transcribe" },
    data: { status: "pending", attempts: 0, error: null, runAfter: new Date(), priority: 5 },
  });
  for (const c of semJob) {
    await db.job.create({
      data: { kind: "transcribe", payload: JSON.stringify({ creativeId: c.id }), priority: 5 },
    });
  }
  console.log(`\n  ${reset.count} reenfileirados, ${semJob.length} criados.`);
}

console.log();
await db.$disconnect();
