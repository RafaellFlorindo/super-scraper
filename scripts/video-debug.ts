/** Mostra o erro completo do último render de vídeo: npm run video-debug */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const r = await db.videoRender.findFirst({ orderBy: { createdAt: "desc" } });
if (!r) {
  console.log("\n  Nenhum render.\n");
} else {
  console.log(`\n  status: ${r.status}`);
  console.log(`  voz: ${r.voice}`);
  const cenas = JSON.parse(r.scenesJson);
  console.log(`  cenas: ${cenas.length}`);
  for (const [i, c] of cenas.entries()) {
    console.log(`   [${i}] tela: "${c.onScreenText}"`);
    console.log(`       fala: "${String(c.narration).slice(0, 120)}"`);
  }
  console.log(`  arquivo: ${r.localPath ?? "(nenhum)"}`);
  if (r.error) console.log(`\n  ERRO:\n${r.error}`);
}

const job = await db.job.findFirst({
  where: { kind: "video" },
  orderBy: { createdAt: "desc" },
});
if (job?.error) console.log(`\n  ERRO DO JOB:\n${job.error}\n`);

await db.$disconnect();
