/**
 * Agregação das vendas por campanha, criativo e forma de pagamento.
 *
 * Regra de dinheiro: só `paid` conta como receita, e reembolso/chargeback são
 * subtraídos. Dashboard que soma tudo que entrou mente para quem olha.
 */
import { db } from "./db";
import { getSetting } from "./settings";
import type { Prisma } from "@prisma/client";

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (v: number) => `${v.toFixed(1)}%`;

export interface Filtro {
  days: number;
  platform?: string;
  product?: string;
  campaign?: string;
}

function where(f: Filtro): Prisma.SaleWhereInput {
  return {
    occurredAt: { gte: new Date(Date.now() - f.days * 86_400_000) },
    ...(f.platform ? { platform: f.platform } : {}),
    ...(f.product ? { productName: f.product } : {}),
    ...(f.campaign ? { utmCampaign: f.campaign } : {}),
  };
}

// ------------------------------------------------------------------ resumo

export interface Resumo {
  /** Receita de vendas pagas, menos reembolso e chargeback. */
  netRevenueCents: number;
  spendCents: number;
  taxCents: number;
  profitCents: number;
  pendingCents: number;
  refundedCents: number;

  paidCount: number;
  refundCount: number;
  chargebackCount: number;

  /** null quando não há gasto lançado: melhor vazio que um número mentiroso. */
  roas: number | null;
  roi: number | null;
  marginPct: number | null;
  refundPct: number;
  chargebackPct: number;
  arpuCents: number;
  taxPercent: number;
}

export async function resumo(f: Filtro): Promise<Resumo> {
  const [sales, spends, taxRaw] = await Promise.all([
    db.sale.findMany({ where: where(f) }),
    db.adSpend.findMany({
      where: {
        day: { gte: new Date(Date.now() - f.days * 86_400_000) },
        ...(f.campaign ? { utmCampaign: f.campaign } : {}),
      },
    }),
    getSetting("TAX_PERCENT", "0"),
  ]);

  const taxPercent = Number(taxRaw) || 0;

  let gross = 0, refunded = 0, pending = 0;
  let paidCount = 0, refundCount = 0, chargebackCount = 0;

  for (const s of sales) {
    if (s.status === "paid") {
      gross += s.amountCents;
      paidCount++;
    } else if (s.status === "refunded") {
      refunded += s.amountCents;
      refundCount++;
    } else if (s.status === "chargeback") {
      refunded += s.amountCents;
      chargebackCount++;
    } else if (s.status === "pending") {
      pending += s.amountCents;
    }
  }

  const netRevenueCents = gross - refunded;
  const spendCents = spends.reduce((a, s) => a + s.amountCents, 0);
  const taxCents = Math.round((netRevenueCents * taxPercent) / 100);
  const profitCents = netRevenueCents - spendCents - taxCents;

  return {
    netRevenueCents,
    spendCents,
    taxCents,
    profitCents,
    pendingCents: pending,
    refundedCents: refunded,
    paidCount,
    refundCount,
    chargebackCount,
    roas: spendCents > 0 ? netRevenueCents / spendCents : null,
    roi: spendCents > 0 ? (profitCents / spendCents) * 100 : null,
    marginPct: netRevenueCents > 0 ? (profitCents / netRevenueCents) * 100 : null,
    refundPct: paidCount > 0 ? (refundCount / paidCount) * 100 : 0,
    chargebackPct: paidCount > 0 ? (chargebackCount / paidCount) * 100 : 0,
    arpuCents: paidCount > 0 ? Math.round(netRevenueCents / paidCount) : 0,
    taxPercent,
  };
}

// -------------------------------------------------------------- série diária

export interface DiaReceita {
  date: string; // yyyy-mm-dd
  label: string; // "dd/mm"
  revenueCents: number;
  spendCents: number;
}

/** Receita líquida e gasto por dia, para o gráfico de tendência do dashboard. */
export async function dailySeries(f: Filtro): Promise<DiaReceita[]> {
  const [sales, spends] = await Promise.all([
    db.sale.findMany({ where: where(f) }),
    db.adSpend.findMany({
      where: {
        day: { gte: new Date(Date.now() - f.days * 86_400_000) },
        ...(f.campaign ? { utmCampaign: f.campaign } : {}),
      },
    }),
  ]);

  const porDia = new Map<string, { revenueCents: number; spendCents: number }>();
  const dias = Math.min(f.days, 90);
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    porDia.set(d.toISOString().slice(0, 10), { revenueCents: 0, spendCents: 0 });
  }

  for (const s of sales) {
    const key = s.occurredAt.toISOString().slice(0, 10);
    const bucket = porDia.get(key);
    if (!bucket) continue;
    if (s.status === "paid") bucket.revenueCents += s.amountCents;
    else if (s.status === "refunded" || s.status === "chargeback") bucket.revenueCents -= s.amountCents;
  }

  for (const s of spends) {
    const key = s.day.toISOString().slice(0, 10);
    const bucket = porDia.get(key);
    if (bucket) bucket.spendCents += s.amountCents;
  }

  return Array.from(porDia.entries()).map(([date, v]) => ({
    date,
    label: date.slice(8, 10) + "/" + date.slice(5, 7),
    ...v,
  }));
}

// ------------------------------------------------------------- pagamentos

/**
 * Cores fixas por forma de pagamento, nesta ordem.
 *
 * A ordem é o mecanismo de segurança para daltonismo, não enfeite: nesta
 * sequência nenhum par vizinho do anel colide (validado com o script do
 * dataviz contra a superfície escura, inclusive o par que fecha o círculo).
 * "outros" fica no amarelo por ser o último do anel, longe do laranja.
 */
export const PAYMENT_COLORS: Record<string, string> = {
  pix: "#3987e5",
  cartao: "#d95926",
  boleto: "#199e70",
  outros: "#c98500",
};

export const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  outros: "Outros",
};

export interface FatiaPagamento {
  method: string;
  label: string;
  color: string;
  count: number;
  cents: number;
  share: number;
}

export async function porPagamento(f: Filtro): Promise<{ fatias: FatiaPagamento[]; total: number }> {
  const sales = await db.sale.findMany({ where: { ...where(f), status: "paid" } });

  const acc = new Map<string, { count: number; cents: number }>();
  for (const s of sales) {
    const k = s.paymentMethod || "outros";
    const cur = acc.get(k) ?? { count: 0, cents: 0 };
    cur.count++;
    cur.cents += s.amountCents;
    acc.set(k, cur);
  }

  const total = sales.length;
  const fatias = Object.keys(PAYMENT_COLORS)
    .map((method) => {
      const v = acc.get(method) ?? { count: 0, cents: 0 };
      return {
        method,
        label: PAYMENT_LABELS[method],
        color: PAYMENT_COLORS[method],
        count: v.count,
        cents: v.cents,
        share: total > 0 ? (v.count / total) * 100 : 0,
      };
    })
    .filter((f) => f.count > 0);

  return { fatias, total };
}

// -------------------------------------------------------------- campanhas

export interface CampaignRow {
  campaign: string;
  paidCount: number;
  refundCount: number;
  revenueCents: number;
  spendCents: number;
  profitCents: number;
  roas: number | null;
  ticketCents: number;
}

export async function campaignReport(f: Filtro): Promise<CampaignRow[]> {
  const since = new Date(Date.now() - f.days * 86_400_000);
  const [sales, spends] = await Promise.all([
    db.sale.findMany({ where: where(f) }),
    db.adSpend.findMany({ where: { day: { gte: since } } }),
  ]);

  const rows = new Map<string, CampaignRow>();
  const get = (campaign: string) => {
    if (!rows.has(campaign)) {
      rows.set(campaign, {
        campaign,
        paidCount: 0, refundCount: 0,
        revenueCents: 0, spendCents: 0, profitCents: 0,
        roas: null, ticketCents: 0,
      });
    }
    return rows.get(campaign)!;
  };

  for (const s of sales) {
    const row = get(s.utmCampaign || "(sem utm_campaign)");
    if (s.status === "paid") {
      row.paidCount++;
      row.revenueCents += s.amountCents;
    } else if (s.status === "refunded" || s.status === "chargeback") {
      row.refundCount++;
      row.revenueCents -= s.amountCents;
    }
  }

  for (const sp of spends) get(sp.utmCampaign).spendCents += sp.amountCents;

  for (const row of rows.values()) {
    row.profitCents = row.revenueCents - row.spendCents;
    row.roas = row.spendCents > 0 ? row.revenueCents / row.spendCents : null;
    row.ticketCents = row.paidCount > 0 ? Math.round(row.revenueCents / row.paidCount) : 0;
  }

  return [...rows.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}

/** Quebra por criativo (utm_content). */
export async function creativeReport(f: Filtro) {
  const sales = await db.sale.findMany({ where: { ...where(f), status: "paid" } });

  const map = new Map<string, { content: string; campaign: string; count: number; cents: number }>();
  for (const s of sales) {
    const content = s.utmContent || "(sem utm_content)";
    const key = `${s.utmCampaign}|${content}`;
    const row = map.get(key) ?? {
      content,
      campaign: s.utmCampaign || "(sem utm_campaign)",
      count: 0,
      cents: 0,
    };
    row.count++;
    row.cents += s.amountCents;
    map.set(key, row);
  }

  return [...map.values()].sort((a, b) => b.cents - a.cents).slice(0, 20);
}

/** Opções para os selects de filtro. */
export async function opcoesFiltro() {
  const [platforms, products, campaigns] = await Promise.all([
    db.sale.findMany({ distinct: ["platform"], select: { platform: true } }),
    db.sale.findMany({
      distinct: ["productName"],
      where: { productName: { not: null } },
      select: { productName: true },
    }),
    db.sale.findMany({
      distinct: ["utmCampaign"],
      where: { utmCampaign: { not: null } },
      select: { utmCampaign: true },
    }),
  ]);

  return {
    platforms: platforms.map((p) => p.platform),
    products: products.map((p) => p.productName!).filter(Boolean),
    campaigns: campaigns.map((c) => c.utmCampaign!).filter(Boolean),
  };
}
