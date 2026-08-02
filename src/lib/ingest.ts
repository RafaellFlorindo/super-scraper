import { db } from "./db.js";
import { computeScaleScore } from "./scale-score.js";
import { classifyInfoproduct } from "./infoproduct.js";
import type { RawAd } from "../scraper/adlibrary.js";

/**
 * Grava um anúncio cru no banco (idempotente por libraryId) e enfileira os
 * jobs de enriquecimento. Rodar duas vezes o mesmo anúncio só adiciona um
 * snapshot novo — que é justamente o que alimenta a série temporal de escala.
 */
export interface IngestResult {
  ad: { id: string };
  /** false quando o anúncio já existia e só foi revisitado. */
  isNew: boolean;
}

export async function ingestAd(raw: RawAd, runId?: string): Promise<IngestResult> {
  // consultado antes do upsert: depois dele não dá mais para saber se existia
  const jaExistia = await db.ad.findUnique({
    where: { libraryId: raw.libraryId },
    select: { id: true },
  });

  const advertiser = await db.advertiser.upsert({
    where: { pageId: raw.pageId },
    create: { pageId: raw.pageId, name: raw.pageName, pageUrl: raw.pageUrl },
    update: { name: raw.pageName },
  });

  const [activeSnapshots, advertiserActiveAds] = await Promise.all([
    db.adSnapshot.count({
      where: { ad: { libraryId: raw.libraryId }, isActive: true },
    }),
    // +1 porque este anúncio (que está ativo agora, senão não estaria na
    // coleta) pode ainda não estar gravado como ativo no banco
    db.ad.count({
      where: { advertiser: { pageId: raw.pageId }, isActive: true, libraryId: { not: raw.libraryId } },
    }),
  ]);

  const scaleScore = computeScaleScore({
    variantCount: raw.variantCount,
    startedAt: raw.startedAt,
    platforms: raw.platforms,
    countries: raw.countries,
    activeSnapshots,
    advertiserActiveAds: advertiserActiveAds + 1,
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
    // firstRunId só no create: é a coleta que DESCOBRIU o anúncio, e re-coletas
    // não podem reescrever essa origem
    create: { libraryId: raw.libraryId, firstRunId: runId ?? null, ...common },
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

  // Criativos só na PRIMEIRA coleta. A Meta assina as URLs de novo a cada
  // visita, então numa re-coleta o mesmo vídeo chega com sourceUrl diferente —
  // o upsert criava uma linha nova por re-coleta, sem job de mídia (o anúncio
  // não é novo), e o detalhe do anúncio enchia de cards "não baixado ainda".
  // Mídia quebrada tem caminho próprio: o job `redownload` renova a URL na
  // linha existente.
  if (!jaExistia) {
    for (const c of raw.creatives) {
      await db.creative.upsert({
        where: { adId_sourceUrl: { adId: ad.id, sourceUrl: c.sourceUrl } },
        create: { adId: ad.id, kind: c.kind, sourceUrl: c.sourceUrl },
        update: {},
      });
    }
  }

  // Enfileira o enriquecimento só na primeira vez que vemos o anúncio. Antes
  // isso era decidido por `classifiedAt === null`, o que refazia os jobs de
  // todo anúncio ainda sem classificação a cada re-coleta.
  const isNew = !jaExistia;
  if (isNew) {
    await enqueue("media", { adId: ad.id });
    await enqueue("enrich", { adId: ad.id });
    if (raw.ctaUrl) await enqueue("funnel", { adId: ad.id });
  }

  return { ad, isNew };
}

/**
 * Prioridade por tipo de job. Maior roda primeiro.
 *
 * A ordem segue duas perguntas: o que o usuário vê primeiro, e o que depende de
 * cota de API.
 *
 * `funnel` já esteve por último, por ser o job mais caro (abre um browser, ~15s
 * por anúncio). Foi um erro: ele é o que descobre PARA ONDE o anúncio manda, o
 * que define se é infoproduto, qual o preço e se dá para clonar a página. E é o
 * único job pesado que **não usa API nenhuma**, então funciona mesmo com a cota
 * de IA zerada. Deixá-lo atrás de `enrich` fazia o dado mais importante ficar
 * refém de um serviço externo que pode estar indisponível.
 */
const PRIORITY: Record<string, number> = {
  mine: 10,
  // vídeo, clone e reparo de mídia são ação direta do usuário, que fica
  // olhando a tela esperando
  video: 9,
  clone: 9,
  redownload: 9,
  media: 8,
  // Empatado com media de propósito: no empate a ordem vira createdAt, então
  // cada vídeo é transcrito logo depois de baixar, em vez de esperar os ~500
  // downloads terminarem. É a VSL que dá material aos agentes.
  transcribe: 8,
  funnel: 5,
  // por último: é o único que fica parado quando a cota de IA acaba
  enrich: 2,
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
