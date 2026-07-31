/**
 * Inspeciona e reprocessa a fila.
 *   npm run jobs            → resumo por tipo e status
 *   npm run jobs -- --retry → devolve os falhos para a fila
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

if (process.argv.includes("--retry")) {
  const { count } = await db.job.updateMany({
    where: { status: "failed" },
    data: { status: "pending", attempts: 0, error: null, runAfter: new Date() },
  });
  console.log(`\n  ${count} jobs devolvidos para a fila.\n`);
} else {
  const groups = await db.job.groupBy({ by: ["kind", "status"], _count: true });
  console.log();
  for (const g of groups.sort((a, b) => a.kind.localeCompare(b.kind))) {
    console.log(`  ${g.kind.padEnd(12)} ${g.status.padEnd(9)} ${g._count}`);
  }
  const failed = await db.job.findMany({ where: { status: "failed" }, take: 3 });
  if (failed.length) {
    console.log("\n  ÚLTIMOS ERROS");
    for (const f of failed) console.log(`  ${f.kind}: ${f.error?.slice(0, 300)}`);
  }
  console.log();
}

await db.$disconnect();
