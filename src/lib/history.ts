/**
 * Histórico dos concorrentes minerados.
 *
 * Cada coleta grava um AdSnapshot. Comparar o snapshot mais recente com o mais
 * antigo dentro da janela responde o que interessa de verdade num espião de
 * anúncios:
 *
 *   quem está escalando AGORA  -> ganhou variações
 *   o que parou de funcionar   -> perdeu variações ou saiu do ar
 *   quem mexeu no preço        -> mudou o valor detectado no funil
 *
 * Anúncio novo não vira "subiu": com uma coleta só não existe comparação, e
 * apresentá-lo como crescimento seria inventar tendência.
 */
import { db } from "./db";

export interface Movimento {
  adId: string;
  advertiser: string;
  headline: string | null;
  niche: string | null;
  thumb: string | null;
  scaleScore: number;
  variantesAntes: number;
  variantesAgora: number;
  delta: number;
  precoAntes: string | null;
  precoAgora: string | null;
  ativo: boolean;
  coletas: number;
}

export interface Historico {
  subindo: Movimento[];
  caindo: Movimento[];
  mortos: Movimento[];
  precoMudou: Movimento[];
  novos: Movimento[];
  /** Anúncios com pelo menos duas coletas: o universo comparável. */
  comparaveis: number;
  total: number;
}

export async function historico(days = 30): Promise<Historico> {
  const desde = new Date(Date.now() - days * 86_400_000);

  const ads = await db.ad.findMany({
    where: { snapshots: { some: { seenAt: { gte: desde } } } },
    include: {
      advertiser: true,
      creatives: { where: { localPath: { not: null } }, take: 1 },
      snapshots: { where: { seenAt: { gte: desde } }, orderBy: { seenAt: "asc" } },
    },
  });

  const movimentos: Movimento[] = ads.map((ad) => {
    const snaps = ad.snapshots;
    const primeiro = snaps[0];
    const ultimo = snaps[snaps.length - 1];

    // preço: compara o primeiro valor conhecido com o último, ignorando os
    // snapshots em que o funil ainda não tinha sido analisado
    const comPreco = snaps.filter((s) => s.price);

    return {
      adId: ad.id,
      advertiser: ad.advertiser.name,
      headline: ad.headline,
      niche: ad.niche,
      thumb: ad.creatives[0]?.localPath ?? null,
      scaleScore: ad.scaleScore,
      variantesAntes: primeiro.variantCount,
      variantesAgora: ultimo.variantCount,
      delta: ultimo.variantCount - primeiro.variantCount,
      precoAntes: comPreco[0]?.price ?? null,
      precoAgora: comPreco[comPreco.length - 1]?.price ?? null,
      ativo: ultimo.isActive,
      coletas: snaps.length,
    };
  });

  const comparaveis = movimentos.filter((m) => m.coletas >= 2);

  return {
    subindo: comparaveis
      .filter((m) => m.delta > 0 && m.ativo)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 12),

    caindo: comparaveis
      .filter((m) => m.delta < 0 && m.ativo)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 12),

    mortos: comparaveis
      .filter((m) => !m.ativo)
      .sort((a, b) => b.scaleScore - a.scaleScore)
      .slice(0, 12),

    precoMudou: comparaveis
      .filter((m) => m.precoAntes && m.precoAgora && m.precoAntes !== m.precoAgora)
      .slice(0, 12),

    novos: movimentos
      .filter((m) => m.coletas === 1)
      .sort((a, b) => b.scaleScore - a.scaleScore)
      .slice(0, 12),

    comparaveis: comparaveis.length,
    total: movimentos.length,
  };
}

/** Série de variações de um anúncio, para o mini gráfico na página dele. */
export async function serieDoAnuncio(adId: string) {
  const snaps = await db.adSnapshot.findMany({
    where: { adId },
    orderBy: { seenAt: "asc" },
  });
  return snaps.map((s) => ({
    seenAt: s.seenAt,
    variantCount: s.variantCount,
    scaleScore: s.scaleScore,
    isActive: s.isActive,
  }));
}
