/**
 * Apaga vendas, gastos e eventos de webhook: npm run clear-sales
 * Use para limpar os dados de teste antes de plugar a plataforma de verdade.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const sales = await db.sale.deleteMany({});
const spends = await db.adSpend.deleteMany({});
const events = await db.webhookEvent.deleteMany({});

console.log(
  `\n  Removidos: ${sales.count} vendas, ${spends.count} gastos, ${events.count} eventos.\n`
);
await db.$disconnect();
