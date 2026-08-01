/** Diagnóstico do que está faltando nos anúncios: npm run diag */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const total = await db.ad.count();
const semCriativo = await db.ad.count({ where: { creatives: { none: {} } } });
const semMidia = await db.ad.count({
  where: { creatives: { some: {}, every: { localPath: null } } },
});
const comFunil = await db.funnel.count();
const semCta = await db.ad.count({ where: { ctaUrl: null } });

console.log(`\n  anúncios .................. ${total}`);
console.log(`  sem nenhum criativo ....... ${semCriativo}`);
console.log(`  com criativo, nada baixado  ${semMidia}`);
console.log(`  sem ctaUrl (não dá funil) . ${semCta}`);
console.log(`  com funil analisado ....... ${comFunil}`);

// vídeos sem áudio: o Whisper recusa e o job fica falhando à toa
const semAudio = await db.job.count({
  where: { kind: "transcribe", status: "failed", error: { contains: "no audio track" } },
});
console.log(`  vídeos sem faixa de áudio . ${semAudio}`);

// jobs presos em running de um worker que morreu
const presos = await db.job.groupBy({
  by: ["kind"],
  where: { status: "running" },
  _count: true,
});
if (presos.length) {
  console.log("\n  JOBS PRESOS EM 'running' (worker morreu no meio)");
  for (const p of presos) console.log(`  ${p.kind.padEnd(12)} ${p._count}`);
}

console.log();
await db.$disconnect();
