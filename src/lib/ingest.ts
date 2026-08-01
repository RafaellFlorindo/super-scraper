import { db } from "./db.js";
import { computeScaleScore } from "./scale-score.js";
import { classifyInfoproduct } from "./infoproduct.js";
import type { RawAd } from "../scraper/adlibrary.js";

/**
 * Grava um anúncio cru no banco (idempotente por libraryId) e enfileira os
 * jobs de enriquecimento. Rodar duas vezes o mesmo anúncio só adiciona um
 * snapshot novo — que é justamente o que alimenta a série temporal de escala.
 */
export async function ingestAd(raw: RawAd) {
  const advertiser = await db.advertiser.upsert({
    where: { pageId: raw.pageId },
    create: { pageId: raw.pageId, name: raw.pageName, pageUrl: raw.pageUrl },
    update: { name: raw.pageName },
  });

  const activeSnapshots = await db.adSnapshot.count({
    where: { ad: { libraryId: raw.libraryId }, isActive: true },
  });

  const scaleScore = computeScaleScore({
    variantCount: raw.variantCount,
    startedAt: raw.startedAt,
    platforms: raw.platforms,
    countries: raw.countries,
    activeSnapshots,
  });

  // Primeira estimativa, só com a ctaUrl. O job de funil recalcula depois com
  // a URL final, que é bem mais confiável (redirect, encurtador, etc).
  const info = classifyInfoproduct({
    ctaUrl: raw.ctaUrl,
    advertiserName: raw.pageName,
    primaryText: raw.primaryText,
    headline: raw.headline,
    hasVideo: raw.creatives.some((c) => c.kind === "video"),
  });

  const common = {
    advertiserId: advertiser.id,
    infoScore: info.score,
    isInfoproduct: info.isInfoproduct,
    primaryText: raw.primaryText,
    headline: raw.headline,
    description: raw.description,
    ctaText: raw.ctaText,
    ctaUrl: raw.ctaUrl,
    platforms: JSON.stringify(raw.platforms),
    countries: JSON.stringify(raw.countries),
    startedAt: raw.startedAt,
    isActive: raw.isActive,
    variantCount: raw.variantCount,
    scaleScore,
    lastSeenAt: new Date(),
    rawJson: JSON.stringify(raw.raw).slice(0, 200_000),
  };

  const ad = await db.ad.upsert({
    where: { libraryId: raw.libraryId },
    create: { libraryId: raw.libraryId, ...common },
    update: common,
  });

  // O preço vem do funil, que é analisado depois da primeira coleta. Guardar
  // junto no snapshot é o que permite ver "subiu de R$97 para R$127" no
  // histórico sem ter que remontar nada.
  const funil = await db.funnel.findUnique({ where: { adId: ad.id } });
  await db.adSnapshot.create({
    data: {
      adId: ad.id,
      variantCount: raw.variantCount,
      isActive: raw.isActive,
      scaleScore,
      price: funil?.detectedPrice ?? null,
    },
  });

  for (const c of raw.creatives) {
    await db.creative.upsert({
      where: { sourceUrl: c.sourceUrl },
      create: { adId: ad.id, kind: c.kind, sourceUrl: c.sourceUrl },
      update: {},
    });
  }

  // enfileira enriquecimento só na primeira vez que vemos o anúncio
  const isNew = ad.classifiedAt === null;
  if (isNew) {
    await enqueue("media", { adId: ad.id });
    await enqueue("enrich", { adId: ad.id });
    if (raw.ctaUrl) await enqueue("funnel", { adId: ad.id });
  }

  return ad;
}

/**
 * Prioridade por tipo de job. Maior roda primeiro.
 *
 * A ordem segue o que o usuário vê: sem `media` não há miniatura nem download,
 * e ela é rápida e não gasta API. `funnel` fica por último porque abre um
 * browser e leva ~15s por anúncio — em FIFO ela sozinha empurra o download de
 * criativos para horas depois.
 */
const PRIORITY: Record<string, number> = {
  mine: 10,
  // vídeo e clone são ação direta do usuário, que fica olhando a tela esperando
  video: 9,
  clone: 9,
  media: 8,
  // Empatado com media de propósito: no empate a ordem vira createdAt, então
  // cada vídeo é transcrito logo depois de baixar, em vez de esperar os ~500
  // downloads terminarem. É a VSL que dá material aos agentes.
  transcribe: 8,
  enrich: 2,
  funnel: 1,
};

export async function enqueue(kind: string, payload: unknown, delayMs = 0) {
  return db.job.create({
    data: {
      kind,
      payload: JSON.stringify(payload),
      priority: PRIORITY[kind] ?? 0,
      runAfter: new Date(Date.now() + delayMs),
    },
  });
}
