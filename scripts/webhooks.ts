/**
 * Inspeciona os webhooks recebidos: npm run webhooks
 * Com --failed, mostra só os que falharam, com o payload inteiro — é assim que
 * você descobre que a plataforma mudou o formato.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const onlyFailed = process.argv.includes("--failed");

const events = await db.webhookEvent.findMany({
  where: onlyFailed ? { ok: false } : {},
  orderBy: { createdAt: "desc" },
  take: onlyFailed ? 5 : 20,
});

for (const e of events) {
  console.log(
    `  ${e.ok ? "✓" : "✗"} ${e.platform.padEnd(8)} ` +
      `${e.createdAt.toLocaleString("pt-BR")}${e.error ? `  ${e.error}` : ""}`
  );
  if (onlyFailed) console.log(`     ${e.bodyJson.slice(0, 800)}\n`);
}

const sales = await db.sale.count();
console.log(`\n  ${events.length} eventos · ${sales} vendas no banco.\n`);
await db.$disconnect();
