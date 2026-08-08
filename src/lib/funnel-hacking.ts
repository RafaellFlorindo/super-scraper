/**
 * Estimativa de faturamento de concorrentes a partir de sinais públicos da
 * Ad Library — a Meta não expõe vendas nem gasto de ninguém, então isto é
 * uma faixa estimada (não uma medição), pensada para RANQUEAR quem vale a
 * pena estudar primeiro, não para afirmar quanto alguém fatura.
 *
 * A curva usa o mesmo scaleScore que já calculamos (variações + longevidade +
 * amplitude + persistência) e mapeia para uma faixa de vendas/dia plausível
 * para infoproduto, depois multiplica pelo preço detectado no funil.
 */
import { db } from "./db";
import { extractPrice } from "./price-extract";

/** Faixa de vendas/dia por faixa de score — validado contra o senso comum do
 * nicho (quem só testa vende poucas unidades; quem escala pesado, dezenas a
 * centenas por dia). Cada faixa é [baixo, alto]. */
function vendasDiaPorScore(score: number): [number, number] {
  if (score >= 75) return [40, 200];
  if (score >= 50) return [10, 40];
  if (score >= 25) return [2, 10];
  return [0, 2];
}

/**
 * Extrai um valor em reais de texto livre. `detectedPrice` (funil) já vem
 * formatado por `extractPrice`; `offerPrice` é texto solto do LLM — tipo "12x
 * de R$ 97,00" ou "de R$ 297 por R$ 197" — que a versão antiga desta função
 * tentava resolver removendo tudo que não fosse dígito/vírgula/ponto e dando
 * `Number()` direto no resto: "R$ 1.997" (sem vírgula) virava 1.997 em vez de
 * 1997, e "12x de R$ 97,00" virava 1297 (concatenava o "12" com o "97,00").
 * Reaproveitar `extractPrice` resolve os dois casos de uma vez, porque ele já
 * entende parcelamento, âncora riscada e separador de milhar.
 */
export function parsePrice(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const formatado = extractPrice(texto);
  if (!formatado) return null;
  // extractPrice sempre devolve "R$ X.XXX,XX" em locale pt-BR fixo — parse seguro
  const n = Number(formatado.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface OfertaEstimada {
  advertiserId: string;
  advertiser: string;
  adId: string;
  headline: string | null;
  thumb: string | null;
  scaleScore: number;
  variantCount: number;
  /** Anúncios ativos deste anunciante no banco — o sinal nº 1 de escala. */
  activeAds: number;
  price: number | null;
  platform: string | null;
  diasNoAr: number | null;
  vendasDiaBaixo: number;
  vendasDiaAlto: number;
  faturamentoMesBaixo: number;
  faturamentoMesAlto: number;
  /**
   * alta: preço vindo da análise de funil E anúncio visto em 3+ coletas.
   * media: tem preço mas pouca observação; baixa: preço veio só do texto do
   * anúncio (LLM), que erra mais.
   */
  confianca: "alta" | "media" | "baixa";
}

export interface FiltroHacking {
  minScore?: number;
  niche?: string;
}

/** Uma oferta por anúncio-âncora (o de maior score de cada anunciante),
 * ranqueada por faturamento mensal estimado, alto a baixo. */
export async function ofertasEstimadas(f: FiltroHacking = {}): Promise<OfertaEstimada[]> {
  const ads = await db.ad.findMany({
    where: {
      isActive: true,
      scaleScore: { gte: f.minScore ?? 0 },
      ...(f.niche ? { niche: f.niche } : {}),
    },
    orderBy: { scaleScore: "desc" },
    include: {
      advertiser: true,
      funnel: true,
      creatives: { where: { localPath: { not: null } }, take: 1 },
      _count: { select: { snapshots: true } },
    },
    take: 300,
  });

  const ativosPorAnunciante = new Map<string, number>();
  for (const grupo of await db.ad.groupBy({
    by: ["advertiserId"],
    where: { isActive: true },
    _count: { id: true },
  })) {
    ativosPorAnunciante.set(grupo.advertiserId, grupo._count.id);
  }

  // um card por anunciante: o anúncio de maior score já representa a oferta
  const porAnunciante = new Map<string, (typeof ads)[number]>();
  for (const ad of ads) {
    if (!porAnunciante.has(ad.advertiserId)) porAnunciante.set(ad.advertiserId, ad);
  }

  const resultado: OfertaEstimada[] = [];
  for (const ad of porAnunciante.values()) {
    const precoDoFunil = parsePrice(ad.funnel?.detectedPrice);
    const price = precoDoFunil ?? parsePrice(ad.offerPrice);
    const [vBaixo, vAlto] = vendasDiaPorScore(ad.scaleScore);
    const diasNoAr = ad.startedAt
      ? Math.round((Date.now() - ad.startedAt.getTime()) / 86_400_000)
      : null;

    const confianca: OfertaEstimada["confianca"] =
      precoDoFunil && ad._count.snapshots >= 3
        ? "alta"
        : precoDoFunil
        ? "media"
        : "baixa";

    resultado.push({
      advertiserId: ad.advertiserId,
      advertiser: ad.advertiser.name,
      adId: ad.id,
      headline: ad.headline,
      thumb: ad.creatives[0]?.localPath ?? null,
      scaleScore: ad.scaleScore,
      variantCount: ad.variantCount,
      activeAds: ativosPorAnunciante.get(ad.advertiserId) ?? 1,
      price,
      platform: ad.funnel?.platform ?? null,
      diasNoAr,
      vendasDiaBaixo: vBaixo,
      vendasDiaAlto: vAlto,
      faturamentoMesBaixo: price ? Math.round(price * vBaixo * 30) : 0,
      faturamentoMesAlto: price ? Math.round(price * vAlto * 30) : 0,
      confianca,
    });
  }

  // sem preço detectado não dá pra estimar R$: manda pro fim, mas não esconde
  // (o score e as variações continuam informação útil sozinhos)
  resultado.sort((a, b) => b.faturamentoMesAlto - a.faturamentoMesAlto || b.scaleScore - a.scaleScore);
  return resultado;
}
