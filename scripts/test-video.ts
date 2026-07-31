/**
 * Monta um vídeo do começo ao fim, fora da fila, para testar rápido.
 *   npm run test-video
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { planScenes, renderVideo, checkDeps, ffmpegPath } from "../src/lib/video.js";

const deps = await checkDeps();
console.log(`\n  ffmpeg: ${ffmpegPath()}`);
console.log(`  dependências: ${deps.ok ? "ok" : "faltando " + deps.missing.join(", ")}`);
if (!deps.ok) process.exit(1);

const creative = await db.generatedCreative.findFirst({
  where: { script: { not: null } },
  orderBy: { createdAt: "desc" },
});
if (!creative) {
  console.log("\n  Nenhum criativo gerado. Gere na aba Criativos primeiro.\n");
  process.exit(0);
}

console.log(`\n  Criativo: ${creative.angle}`);

/** Com --fake, pula a IA e usa cenas fixas: testa só a montagem. */
const CENAS_FIXAS = [
  { narration: "Você faz brownie que todo mundo elogia, mas nunca vendeu nenhum?", onScreenText: "Todo mundo elogia. Ninguém compra." },
  { narration: "O problema quase nunca é a receita. É não saber quanto cobrar.", onScreenText: "O problema não é a receita" },
  { narration: "São trinta receitas com rendimento calculado e a tabela de preço pronta.", onScreenText: "30 receitas com preço calculado" },
  { narration: "Você abre a planilha, coloca o custo dos seus ingredientes e já sai o valor de venda.", onScreenText: "Coloque o custo. Saia com o preço." },
  { narration: "Clique no botão abaixo e comece a vender ainda esta semana.", onScreenText: "Comece esta semana" },
];

let scenes;
if (process.argv.includes("--fake")) {
  console.log("  Usando cenas fixas (sem IA).");
  scenes = CENAS_FIXAS;
} else {
  console.log("  Planejando cenas...");
  scenes = await planScenes(creative.id);
}
console.log(`  ${scenes.length} cenas:`);
for (const [i, s] of scenes.entries()) {
  console.log(`    [${i}] "${s.onScreenText}" | ${s.narration.slice(0, 70)}`);
}

const render = await db.videoRender.create({
  data: { generatedCreativeId: creative.id, scenesJson: JSON.stringify(scenes) },
});

console.log("\n  Renderizando (narração + prints + montagem)...");
const t0 = Date.now();
const rel = await renderVideo(render.id);
console.log(`\n  Pronto em ${((Date.now() - t0) / 1000).toFixed(0)}s: ${rel}`);

const final = await db.videoRender.findUnique({ where: { id: render.id } });
console.log(`  Duração: ${final?.durationSec?.toFixed(1)}s`);
console.log(`  Veja em: http://localhost:3000/api/media/${rel}\n`);

await db.$disconnect();
