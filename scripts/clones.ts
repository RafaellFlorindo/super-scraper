/** Estado das páginas clonadas: npm run clones */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const clones = await db.clonedPage.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

for (const c of clones) {
  console.log(`\n  ${c.status.toUpperCase()}  /p/${c.slug}`);
  console.log(`  origem: ${c.sourceUrl}`);
  if (c.status === "done") {
    console.log(`  título: ${c.title}`);
    console.log(`  ${c.files} arquivos · ${(c.bytes / 1e6).toFixed(2)} MB`);
    console.log(`  rastreadores removidos: ${c.strippedTrackers}`);
  }
  if (c.error) console.log(`  ERRO: ${c.error}`);
}
console.log();
await db.$disconnect();
