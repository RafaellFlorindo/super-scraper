/** Acha a URL de um anúncio pelo anunciante: npm run ad-url -- Diego */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const termo = process.argv[2] ?? "";
const ads = await db.ad.findMany({
  where: {
    advertiser: { name: { contains: termo } },
    creatives: { some: { localPath: { not: null } } },
  },
  include: { advertiser: true, funnel: true, creatives: true },
  take: 4,
});

for (const a of ads) {
  console.log(`\n  ${a.advertiser.name}`);
  console.log(`  http://localhost:3000/ads/${a.id}`);
  console.log(`  criativos: ${a.creatives.length} (${a.creatives.filter((c) => c.localPath).length} baixados)`);
  console.log(`  funil: ${a.funnel?.finalUrl ?? "ainda não analisado"}`);
  console.log(`  preço: ${a.funnel?.detectedPrice ?? ""}`);
}
console.log();
await db.$disconnect();
