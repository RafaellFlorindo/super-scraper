/**
 * Remove criativos duplicados dentro do mesmo anúncio, comparando o conteúdo
 * do arquivo em vez da URL.
 *
 *   npm run dedupe
 *
 * Necessário porque as URLs da Meta são assinadas e mudam a cada coleta, e o
 * mesmo vídeo ainda vem em versão HD e SD. Mantém o maior arquivo de cada
 * conteúdo repetido, junto com a transcrição, se já houver.
 */
import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import { db } from "../src/lib/db.js";
import { absolute } from "../src/lib/storage.js";

const baixados = await db.creative.findMany({ where: { localPath: { not: null } } });

console.log(`\n  Calculando hash de ${baixados.length} arquivos...`);
let semArquivo = 0;

for (const c of baixados) {
  const file = absolute(c.localPath!);
  if (!fs.existsSync(file)) {
    semArquivo++;
    continue;
  }
  if (c.contentHash) continue;
  const hash = crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
  await db.creative.update({ where: { id: c.id }, data: { contentHash: hash } });
}

// agrupa por (anúncio, hash) e mantém só um de cada
const todos = await db.creative.findMany({
  where: { contentHash: { not: null } },
  orderBy: { bytes: "desc" },
});

const visto = new Map<string, (typeof todos)[number]>();
const remover: typeof todos = [];

for (const c of todos) {
  const chave = `${c.adId}|${c.contentHash}`;
  const anterior = visto.get(chave);
  if (!anterior) {
    visto.set(chave, c);
    continue;
  }
  // se o duplicado tem transcrição e o mantido não, salva a transcrição
  if (c.transcript && !anterior.transcript) {
    await db.creative.update({
      where: { id: anterior.id },
      data: { transcript: c.transcript, transcribedAt: c.transcribedAt },
    });
    anterior.transcript = c.transcript;
  }
  remover.push(c);
}

for (const c of remover) {
  if (c.localPath) fs.rmSync(absolute(c.localPath), { force: true });
  await db.job.deleteMany({ where: { kind: "transcribe", payload: { contains: c.id } } });
  await db.creative.delete({ where: { id: c.id } });
}

console.log(`  ${remover.length} duplicatas removidas.`);
if (semArquivo) console.log(`  ${semArquivo} registros apontam para arquivo inexistente.`);
console.log(`  ${await db.creative.count()} criativos restantes.\n`);

await db.$disconnect();
