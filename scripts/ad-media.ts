/** Mostra os criativos de um anúncio, por anunciante: npm run ad-media -- AleMonteiro */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const termo = process.argv[2] ?? "";
const ads = await db.ad.findMany({
  where: { advertiser: { name: { contains: termo } } },
  include: { advertiser: true, creatives: true },
  take: 5,
});

for (const ad of ads) {
  console.log(`\n  ${ad.advertiser.name} | ${ad.variantCount}x variações`);
  console.log(`  http://localhost:3000/ads/${ad.id}`);
  for (const c of ad.creatives) {
    console.log(
      `    ${c.kind.padEnd(5)} ${String(c.bytes ?? 0).padStart(9)} bytes  ` +
        `hash ${c.contentHash?.slice(0, 12) ?? "sem hash"}`
    );
  }
}
console.log();
await db.$disconnect();
