/**
 * Recalcula infoScore/isInfoproduct em todo o banco.
 * Use depois de mexer nas regras de src/lib/infoproduct.ts.
 *   npm run reclassify
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { classifyInfoproduct } from "../src/lib/infoproduct.js";

const ads = await db.ad.findMany({
  include: { advertiser: true, funnel: true, creatives: true },
});

let info = 0;
for (const ad of ads) {
  const r = classifyInfoproduct({
    ctaUrl: ad.ctaUrl,
    finalUrl: ad.funnel?.finalUrl,
    advertiserName: ad.advertiser.name,
    primaryText: ad.primaryText,
    headline: ad.headline,
    hasVideo: ad.creatives.some((c) => c.kind === "video"),
  });
  await db.ad.update({
    where: { id: ad.id },
    data: { infoScore: r.score, isInfoproduct: r.isInfoproduct },
  });
  if (r.isInfoproduct) info++;
}

console.log(`\n  ${ads.length} anúncios reavaliados — ${info} infoprodutos, ${ads.length - info} negócio local.\n`);
await db.$disconnect();
