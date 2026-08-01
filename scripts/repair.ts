/**
 * Conserta o estado do banco depois das correções de prioridade e unicidade.
 *
 *   npm run repair
 *
 * O que faz:
 * 1. Recria os criativos que sumiram por causa da unicidade global de sourceUrl
 *    (o mesmo vídeo em dois anúncios do mesmo anunciante: só o primeiro ficava
 *    com a mídia).
 * 2. Reaplica a prioridade por tipo na fila existente.
 * 3. Devolve à fila os jobs presos em "running" de workers que morreram.
 * 4. Encerra as transcrições de vídeo sem áudio, que só falhariam de novo.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const PRIORITY: Record<string, number> = {
  mine: 10,
  video: 9,
  clone: 9,
  media: 8,
  transcribe: 8,
  funnel: 5,
  enrich: 2,
};

// ---------------------------------------------- 1. criativos desaparecidos
const semCriativo = await db.ad.findMany({
  where: { creatives: { none: {} } },
  select: { id: true, rawJson: true },
});

let recriados = 0;
let jobsMedia = 0;

for (const ad of semCriativo) {
  let raw: any;
  try {
    raw = JSON.parse(ad.rawJson);
  } catch {
    continue;
  }

  const snap = raw?.snapshot ?? {};
  const cards: any[] = Array.isArray(snap.cards) ? snap.cards : [];
  const fontes = cards.length
    ? cards
    : [
        ...(Array.isArray(snap.videos) ? snap.videos : []),
        ...(Array.isArray(snap.images) ? snap.images : []),
      ];

  const vistos = new Set<string>();
  const criativos: { kind: string; sourceUrl: string }[] = [];

  for (const f of fontes) {
    const video = f?.video_hd_url || f?.video_sd_url;
    if (video && !vistos.has(video)) {
      vistos.add(video);
      criativos.push({ kind: "video", sourceUrl: video });
    }
    const imagem = f?.original_image_url || f?.resized_image_url;
    if (imagem && !vistos.has(imagem)) {
      vistos.add(imagem);
      criativos.push({ kind: "image", sourceUrl: imagem });
    }
  }

  if (!criativos.length) continue;

  for (const c of criativos) {
    await db.creative.upsert({
      where: { adId_sourceUrl: { adId: ad.id, sourceUrl: c.sourceUrl } },
      create: { adId: ad.id, kind: c.kind, sourceUrl: c.sourceUrl },
      update: {},
    });
    recriados++;
  }

  await db.job.create({
    data: { kind: "media", payload: JSON.stringify({ adId: ad.id }), priority: 8 },
  });
  jobsMedia++;
}

console.log(`\n  ${recriados} criativo(s) recriados em ${jobsMedia} anúncio(s).`);

// ------------------------------------------------------- 2. prioridades
for (const [kind, priority] of Object.entries(PRIORITY)) {
  const { count } = await db.job.updateMany({
    where: { kind, status: { in: ["pending", "failed"] } },
    data: { priority },
  });
  if (count) console.log(`  ${kind.padEnd(11)} ${count} job(s) -> prioridade ${priority}`);
}

// ------------------------------------------------------------ 3. órfãos
const { count: orfaos } = await db.job.updateMany({
  where: { status: "running" },
  data: { status: "pending", runAfter: new Date() },
});
console.log(`\n  ${orfaos} job(s) presos em "running" devolvidos à fila.`);

// -------------------------------------------------- 4. vídeos sem áudio
const mudos = await db.job.findMany({
  where: { kind: "transcribe", status: "failed", error: { contains: "no audio track" } },
});
for (const job of mudos) {
  const { creativeId } = JSON.parse(job.payload) as { creativeId: string };
  await db.creative
    .update({ where: { id: creativeId }, data: { transcript: "", transcribedAt: new Date() } })
    .catch(() => {});
  await db.job.update({ where: { id: job.id }, data: { status: "done", error: null } });
}
console.log(`  ${mudos.length} vídeo(s) sem áudio encerrados em vez de ficar tentando.\n`);

await db.$disconnect();
