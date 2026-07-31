/** Lista anúncios que já têm VSL transcrita: npm run find-vsl */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const creatives = await db.creative.findMany({
  where: { transcript: { not: null } },
  include: { ad: { include: { advertiser: true } } },
  take: 8,
});

for (const c of creatives) {
  console.log(
    `  ${c.ad.advertiser.name.slice(0, 28).padEnd(28)} ` +
      `${String(c.transcript!.length).padStart(5)} chars  ` +
      `http://localhost:3000/ads/${c.adId}`
  );
}
console.log();
await db.$disconnect();
