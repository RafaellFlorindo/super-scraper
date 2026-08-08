/**
 * Reenfileira a análise de funil (que é o que detecta o preço) para anúncios
 * que já têm `detectedPrice` gravado — depois da correção do extrator de
 * preço (src/lib/price-extract.ts), que passou a ignorar "receba até R$X" de
 * anúncio de benefício/financiamento.
 *
 * Não dá pra corrigir o preço só recalculando: o texto da página de vendas não
 * fica guardado no banco, só o preço já extraído. A única forma de corrigir um
 * registro antigo é visitar a página nas mesma de novo — e é isso que o job
 * `funnel` faz. Por isso este script só enfileira; quem processa é o worker
 * (`npm run worker` precisa estar rodando).
 *
 * Uso:
 *   npm run reanalyze-price                  # mostra quantos seriam reenfileirados (dry-run)
 *   npm run reanalyze-price -- --yes         # enfileira de verdade
 *   npm run reanalyze-price -- --niche "auxílio maternidade" --yes   # só um nicho
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { enqueue } from "../src/lib/ingest.js";

const args = process.argv.slice(2);
const confirmado = args.includes("--yes");
const nicheIdx = args.indexOf("--niche");
const niche = nicheIdx >= 0 ? args[nicheIdx + 1] : undefined;

const ads = await db.ad.findMany({
  where: {
    ctaUrl: { not: null },
    funnel: { detectedPrice: { not: null } },
    ...(niche ? { niche } : {}),
  },
  select: { id: true, headline: true, niche: true, funnel: { select: { detectedPrice: true } } },
});

if (ads.length === 0) {
  console.log("\n  Nenhum anúncio com preço detectado bate com esse filtro.\n");
  await db.$disconnect();
  process.exit(0);
}

console.log(`\n  ${ads.length} anúncio(s) com preço detectado${niche ? ` no nicho "${niche}"` : ""}:\n`);
for (const ad of ads.slice(0, 20)) {
  console.log(`    ${(ad.funnel?.detectedPrice ?? "").padEnd(14)} ${(ad.headline ?? "(sem headline)").slice(0, 60)}`);
}
if (ads.length > 20) console.log(`    ... e mais ${ads.length - 20}`);

if (!confirmado) {
  console.log(
    `\n  Isto é um dry-run — nada foi enfileirado. Rode de novo com --yes para reenfileirar a análise de funil` +
      ` desses ${ads.length} anúncios (o worker precisa estar rodando pra processar; cada um abre um browser real,` +
      ` ~15-45s).\n`
  );
  await db.$disconnect();
  process.exit(0);
}

for (const ad of ads) await enqueue("funnel", { adId: ad.id });
console.log(`\n  ${ads.length} anúncio(s) reenfileirado(s) para reanálise de funil. Acompanhe com: npm run jobs\n`);
await db.$disconnect();
