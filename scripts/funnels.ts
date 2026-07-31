/** Lista os funis analisados: npm run funnels */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const funnels = await db.funnel.findMany({ include: { ad: { include: { advertiser: true } } } });
for (const f of funnels) {
  console.log(
    `  ${(f.platform ?? "?").padEnd(10)} ${(f.detectedPrice ?? "sem preço").padEnd(12)} ` +
      `${f.ad.advertiser.name.slice(0, 22).padEnd(22)} ${(f.finalUrl ?? "").slice(0, 55)}`
  );
}
console.log(`\n  ${funnels.length} funis analisados.\n`);
await db.$disconnect();
