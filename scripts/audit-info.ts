/** Confere o ranking de infoScore para calibrar as regras: npm run audit */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const ads = await db.ad.findMany({
  orderBy: { infoScore: "desc" },
  include: { advertiser: true, funnel: true },
});

for (const a of ads) {
  const mark = a.isInfoproduct ? "✔" : " ";
  console.log(
    `  ${mark} ${String(a.infoScore).padStart(3)}  ${a.advertiser.name.slice(0, 26).padEnd(26)} ` +
      `${(a.funnel?.finalUrl ?? a.ctaUrl ?? "sem link").slice(0, 58)}`
  );
}
console.log(`\n  ${ads.filter((a) => a.isInfoproduct).length}/${ads.length} classificados como infoproduto.\n`);
await db.$disconnect();
