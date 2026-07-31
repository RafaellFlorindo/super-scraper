/** Diagnóstico rápido do banco: npm run stats */
import "dotenv/config";
import { db } from "../src/lib/db.js";

console.log("\n  anúncios ....", await db.ad.count());
console.log("  criativos ...", await db.creative.count(),
  `(${await db.creative.count({ where: { kind: "video" } })} vídeos,`,
  `${await db.creative.count({ where: { localPath: { not: null } } })} baixados)`);
console.log("  classificados", await db.ad.count({ where: { classifiedAt: { not: null } } }));
console.log("  funis .......", await db.funnel.count());
console.log("  jobs ........",
  await db.job.count({ where: { status: "pending" } }), "pendentes,",
  await db.job.count({ where: { status: "failed" } }), "falhos");

const top = await db.ad.findMany({
  orderBy: { scaleScore: "desc" },
  take: 8,
  include: { advertiser: true, creatives: true },
});

console.log("\n  TOP POR SCORE DE ESCALA");
for (const a of top) {
  console.log(
    `  ${String(a.scaleScore).padStart(3)}  ${a.advertiser.name.slice(0, 24).padEnd(24)} ` +
      `${a.variantCount}x  ${a.creatives.length} mídia  ${a.niche ?? "-"}`
  );
  console.log(`       ${(a.ctaUrl ?? "sem link").slice(0, 78)}`);
}

const failed = await db.job.findMany({ where: { status: "failed" }, take: 3 });
if (failed.length) {
  console.log("\n  JOBS FALHOS");
  for (const f of failed) console.log(`  ${f.kind}: ${f.error}`);
}

console.log();
await db.$disconnect();
