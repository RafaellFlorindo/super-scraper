/** Mostra a configuração efetiva e de onde ela vem: npm run config */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { getMaskedSettings } from "../src/lib/settings.js";

console.log("\n  GRAVADO NO BANCO");
const rows = await db.setting.findMany();
if (!rows.length) console.log("  (nada — tudo vindo do .env)");
for (const r of rows) {
  console.log(`  ${r.key.padEnd(20)} cifrado=${r.encrypted}  ${r.value.slice(0, 34)}...`);
}

console.log("\n  VALOR EFETIVO");
for (const s of await getMaskedSettings()) {
  console.log(`  ${s.key.padEnd(20)} ${s.source.padEnd(5)} ${s.preview || "(vazio)"}`);
}
console.log();
await db.$disconnect();
