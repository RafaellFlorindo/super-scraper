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

console.log(`\n  Minerando "${query}" (${country}), até ${limit} anúncios INÉDITOS.`);
console.log("  Já conhecidos são pulados, e a rolagem continua atrás de novidade.\n");

let n = 0;
let novos = 0;
try {
  await mineAdLibrary({
    query,
    country,
    limit,
    onAd: async (ad) => {
      try {
        const { isNew } = await ingestAd(ad);
        n++;
        if (isNew) novos++;
        if (runId) await db.miningRun.update({ where: { id: runId }, data: { found: n, novos } });
        const label = (ad.headline ?? ad.primaryText ?? "").slice(0, 50).replace(/\s+/g, " ");
        console.log(
          `  ${isNew ? "NOVO" : "   ."} [${String(novos).padStart(3)}] ` +
            `${ad.pageName.slice(0, 20).padEnd(20)} ${label}`
        );
        return isNew;
      } catch (e) {
        console.error(`  ! falha ao gravar ${ad.libraryId}:`, (e as Error).message);
        return false;
      }
    },
  });

  if (runId) {
    await db.miningRun.update({
      where: { id: runId },
      data: { status: "done", found: n, novos, endedAt: new Date() },
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
console.log(
  `\n  Pronto. ${n} anúncios vistos, ${novos} novos, ${n - novos} já estavam no banco.` +
    `\n  ${total} no total.`
);
console.log("  Rode `npm run worker` para baixar criativos, transcrever e classificar.\n");
await db.$disconnect();
