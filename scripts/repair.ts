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
 * 5. Enfileira `funnel` para anúncios com link que nunca ganharam esse job
 *    (o job só é criado na primeira vez que o anúncio é visto; se aquilo
 *    falhou por qualquer motivo, o anúncio ficava órfão pra sempre).
 * 6. Enfileira `redownload` para criativos com erro de download registrado,
 *    que sem isso ficavam com localPath null pra sempre.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const PRIORITY: Record<string, number> = {
  mine: 10,
  video: 9,
  clone: 9,
  redownload: 9,
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
console.log(`  ${mudos.length} vídeo(s) sem áudio encerrados em vez de ficar tentando.`);

// ------------------------------------------------ 5. funil órfão
const comCta = await db.ad.findMany({
  where: { ctaUrl: { not: null }, funnel: null },
  select: { id: true },
});
const jobsFunnelPendentes = new Set(
  (
    await db.job.findMany({
      where: { kind: "funnel", status: { in: ["pending", "running"] } },
      select: { payload: true },
    })
  ).map((j) => JSON.parse(j.payload).adId as string)
);
let funisCriados = 0;
for (const ad of comCta) {
  if (jobsFunnelPendentes.has(ad.id)) continue;
  await db.job.create({
    data: { kind: "funnel", payload: JSON.stringify({ adId: ad.id }), priority: 5 },
  });
  funisCriados++;
}
console.log(`  ${funisCriados} anúncio(s) sem funil e sem job na fila: job criado.`);

// ---------------------------------------------- 6. criativos com erro
const comErro = await db.creative.findMany({
  where: { downloadError: { not: null } },
  select: { adId: true },
  distinct: ["adId"],
});
const jobsRedownloadPendentes = new Set(
  (
    await db.job.findMany({
      where: { kind: "redownload", status: { in: ["pending", "running"] } },
      select: { payload: true },
    })
  ).map((j) => JSON.parse(j.payload).adId as string)
);
let redownloadsCriados = 0;
for (const c of comErro) {
  if (jobsRedownloadPendentes.has(c.adId)) continue;
  await db.job.create({
    data: { kind: "redownload", payload: JSON.stringify({ adId: c.adId }), priority: 9 },
  });
  redownloadsCriados++;
}
console.log(`  ${redownloadsCriados} anúncio(s) com criativo quebrado: reparo enfileirado.`);

// ------------------------------------- 7. recalcular score de escala
// A fórmula ganhou o sinal "anúncios ativos do anunciante"; sem recalcular,
// anúncios antigos ficariam com score da fórmula velha para sempre.
const { computeScaleScore } = await import("../src/lib/scale-score.js");
const todosAds = await db.ad.findMany({
  select: {
    id: true, advertiserId: true, variantCount: true, startedAt: true,
    platforms: true, countries: true, scaleScore: true,
  },
});
const ativosPorAnunciante = new Map<string, number>();
for (const grupo of await db.ad.groupBy({
  by: ["advertiserId"],
  where: { isActive: true },
  _count: { id: true },
})) {
  ativosPorAnunciante.set(grupo.advertiserId, grupo._count.id);
}
const snapshotsAtivos = new Map<string, number>();
for (const grupo of await db.adSnapshot.groupBy({
  by: ["adId"],
  where: { isActive: true },
  _count: { id: true },
})) {
  snapshotsAtivos.set(grupo.adId, grupo._count.id);
}
let recalculados = 0;
for (const ad of todosAds) {
  const novo = computeScaleScore({
    variantCount: ad.variantCount,
    startedAt: ad.startedAt,
    platforms: JSON.parse(ad.platforms) as string[],
    countries: JSON.parse(ad.countries) as string[],
    activeSnapshots: snapshotsAtivos.get(ad.id) ?? 0,
    advertiserActiveAds: ativosPorAnunciante.get(ad.advertiserId) ?? 1,
  });
  if (novo !== ad.scaleScore) {
    await db.ad.update({ where: { id: ad.id }, data: { scaleScore: novo } });
    recalculados++;
  }
}
console.log(`  ${recalculados} score(s) de escala recalculados com a fórmula nova.`);

// --------------------------- 8. criativos duplicados de re-coleta
// Antes da correção no ingest, cada re-coleta criava linhas novas de criativo
// com URL re-assinada e nunca baixava (o job de mídia só roda para anúncio
// novo). Se o anúncio já tem mídia daquele tipo baixada, a linha vazia é
// duplicata: apaga. Se não tem nenhuma, mantém e manda para o redownload.
const fantasmas = await db.creative.findMany({
  where: { localPath: null, downloadError: null },
  select: { id: true, adId: true, kind: true },
});
const baixadosPorAd = new Map<string, Set<string>>();
for (const c of await db.creative.findMany({
  where: { localPath: { not: null } },
  select: { adId: true, kind: true },
})) {
  if (!baixadosPorAd.has(c.adId)) baixadosPorAd.set(c.adId, new Set());
  baixadosPorAd.get(c.adId)!.add(c.kind);
}
let apagados = 0;
const precisamRedownload = new Set<string>();
for (const f of fantasmas) {
  if (baixadosPorAd.get(f.adId)?.has(f.kind)) {
    await db.creative.delete({ where: { id: f.id } }).catch(() => {});
    apagados++;
  } else {
    precisamRedownload.add(f.adId);
  }
}
let redownloadsFantasma = 0;
for (const adId of precisamRedownload) {
  if (jobsRedownloadPendentes.has(adId)) continue;
  await db.job.create({
    data: { kind: "redownload", payload: JSON.stringify({ adId }), priority: 9 },
  });
  jobsRedownloadPendentes.add(adId);
  redownloadsFantasma++;
}
console.log(
  `  ${apagados} criativo(s) duplicados de re-coleta apagados; ` +
    `${redownloadsFantasma} anúncio(s) sem mídia nenhuma mandados para redownload.\n`
);

await db.$disconnect();
