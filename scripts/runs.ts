/** Histórico de minerações disparadas pela interface: npm run runs */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const runs = await db.miningRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 });
for (const r of runs) {
  console.log(
    `  ${r.status.padEnd(8)} ${String(r.found).padStart(3)} anúncios  "${r.query}" (${r.country})` +
      (r.error ? `\n     erro: ${r.error.slice(0, 200)}` : "")
  );
}
console.log();
await db.$disconnect();
