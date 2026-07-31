/**
 * Minerador manual.
 *   npm run mine -- "curso de confeitaria" --limit 40 --country BR
 */
import "dotenv/config";
import { mineAdLibrary } from "../src/scraper/adlibrary.js";
import { ingestAd } from "../src/lib/ingest.js";
import { db } from "../src/lib/db.js";

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const query = process.argv[2];
if (!query || query.startsWith("--")) {
  console.error('Uso: npm run mine -- "termo de busca" [--limit 40] [--country BR]');
  process.exit(1);
}

const limit = Number(arg("limit", "40"));
const country = arg("country", "BR")!;
/** Preenchido quando a mineração foi disparada pela interface. */
const runId = arg("run");

console.log(`\n  Minerando "${query}" (${country}), até ${limit} anúncios...`);
console.log("  Uma janela do Chrome vai abrir. Não feche — ela é a coleta.\n");

let n = 0;
try {
  await mineAdLibrary({
    query,
    country,
    limit,
    onAd: async (ad) => {
      try {
        await ingestAd(ad);
        n++;
        if (runId) await db.miningRun.update({ where: { id: runId }, data: { found: n } });
        const label = (ad.headline ?? ad.primaryText ?? "").slice(0, 55).replace(/\s+/g, " ");
        console.log(
          `  [${String(n).padStart(3)}] ${ad.pageName.slice(0, 22).padEnd(22)} ` +
            `${String(ad.variantCount).padStart(3)}x  ${label}`
        );
      } catch (e) {
        console.error(`  ! falha ao gravar ${ad.libraryId}:`, (e as Error).message);
      }
    },
  });

  if (runId) {
    await db.miningRun.update({
      where: { id: runId },
      data: { status: "done", found: n, endedAt: new Date() },
    });
  }
} catch (e) {
  if (runId) {
    await db.miningRun.update({
      where: { id: runId },
      data: { status: "failed", error: (e as Error).message.slice(0, 500), endedAt: new Date() },
    });
  }
  throw e;
}

const total = await db.ad.count();
console.log(`\n  Pronto. ${n} anúncios nesta rodada, ${total} no banco.`);
console.log("  Rode `npm run worker` para baixar criativos, transcrever e classificar.\n");
await db.$disconnect();
