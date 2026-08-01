/** O que a última mineração realmente trouxe: npm run ultima-coleta */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const run = await db.miningRun.findFirst({ orderBy: { startedAt: "desc" } });
if (!run) {
  console.log("\n  Nenhuma coleta.\n");
  process.exit(0);
}

console.log(`\n  "${run.query}" (${run.country}) · ${run.status}`);
console.log(`  contador da tela: ${run.found}`);
console.log(`  iniciada: ${run.startedAt.toLocaleString("pt-BR")}`);

// anúncios cujo registro nasceu depois do início da coleta = realmente novos
const novos = await db.ad.count({ where: { createdAt: { gte: run.startedAt } } });
// anúncios que já existiam e só foram revisitados
const revisitados = await db.adSnapshot.count({
  where: { seenAt: { gte: run.startedAt }, ad: { createdAt: { lt: run.startedAt } } },
});

console.log(`\n  novos de verdade: ${novos}`);
console.log(`  já existiam, só atualizados: ${revisitados}`);

const amostra = await db.ad.findMany({
  where: { createdAt: { gte: run.startedAt } },
  include: { advertiser: true },
  take: 5,
});
for (const a of amostra) {
  console.log(`   - ${a.advertiser.name}: ${(a.headline ?? "").slice(0, 50)}`);
  console.log(`     infoproduto=${a.isInfoproduct} score=${a.infoScore} funil=${a.ctaUrl ? "tem cta" : "sem cta"}`);
}

console.log();
await db.$disconnect();
