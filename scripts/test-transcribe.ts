/** Transcreve um vídeo já baixado, para validar a chave do Groq: npm run test-transcribe */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { HANDLERS } from "../src/workers/handlers.js";

const creative = await db.creative.findFirst({
  where: { kind: "video", localPath: { not: null }, transcript: null },
  include: { ad: { include: { advertiser: true } } },
});

if (!creative) {
  console.log("\n  Nenhum vídeo baixado e pendente de transcrição.\n");
  process.exit(0);
}

console.log(`\n  Anunciante: ${creative.ad.advertiser.name}`);
console.log(`  Arquivo: ${creative.localPath} (${((creative.bytes ?? 0) / 1e6).toFixed(1)} MB)`);
console.log("  Transcrevendo...\n");

await HANDLERS.transcribe({ creativeId: creative.id });

const done = await db.creative.findUnique({ where: { id: creative.id } });
if (done?.transcript) {
  console.log(`  ✓ ${done.transcript.length} caracteres:\n`);
  console.log(`  ${done.transcript.slice(0, 600).replace(/\n/g, "\n  ")}\n`);
} else {
  console.log("  ✗ Transcrição vazia.\n");
}

await db.$disconnect();
