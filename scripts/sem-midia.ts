/** Investiga anúncios que ficaram sem nenhum criativo: npm run sem-midia */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const ads = await db.ad.findMany({
  where: { creatives: { none: {} } },
  include: { advertiser: true },
  take: 4,
});

for (const ad of ads) {
  const raw = JSON.parse(ad.rawJson);
  const snap = raw.snapshot ?? {};
  console.log(`\n  ${ad.advertiser.name}`);
  console.log(`  display_format: ${snap.display_format}`);
  console.log(`  cards: ${Array.isArray(snap.cards) ? snap.cards.length : "n/a"}`);
  console.log(`  videos: ${Array.isArray(snap.videos) ? snap.videos.length : "n/a"}`);
  console.log(`  images: ${Array.isArray(snap.images) ? snap.images.length : "n/a"}`);
  console.log(`  extra_videos: ${Array.isArray(snap.extra_videos) ? snap.extra_videos.length : "n/a"}`);
  console.log(`  extra_images: ${Array.isArray(snap.extra_images) ? snap.extra_images.length : "n/a"}`);

  // que chaves de mídia existem no snapshot?
  const chaves = Object.keys(snap).filter((k) => /video|image|media|thumb/i.test(k));
  console.log(`  chaves de mídia: ${chaves.join(", ")}`);

  if (Array.isArray(snap.cards) && snap.cards.length) {
    console.log(`  chaves do card[0]: ${Object.keys(snap.cards[0]).filter((k) => /video|image/i.test(k)).join(", ")}`);
  }
}
console.log();
await db.$disconnect();
