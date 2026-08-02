/**
 * Caminho de vitórias por faturamento, no espírito das premiações da Kiwify.
 *
 * Faturamento é **vitalício**, não filtrado por período: é o total desde a
 * primeira venda. Diferente do Traqueamento (que olha 7/30/90 dias), a ideia
 * aqui é o marco histórico, então nenhum filtro de data se aplica.
 *
 * A data de conquista é real, não estimada: soma-se cada venda em ordem
 * cronológica (paga soma, reembolso/chargeback subtrai) e marca-se o instante
 * exato em que o acumulado cruzou cada degrau. Uma vez conquistado, o selo
 * fica — reembolso posterior derruba o saldo mas não tira a medalha, do
 * mesmo jeito que plataforma nenhuma cobra de volta um prêmio já pago.
 */
import { db } from "./db";

export type Tier = "bronze" | "prata" | "ouro" | "esmeralda" | "esmeralda-escura" | "onix";

export interface Milestone {
  id: string;
  label: string;
  amountCents: number;
  tier: Tier;
}

/** Mesma escada de valores da referência: 10K, 100K, 1M, 5M, 10M, 25M. */
export const MILESTONES: Milestone[] = [
  { id: "10k", label: "R$ 10 mil", amountCents: 10_000_00, tier: "bronze" },
  { id: "100k", label: "R$ 100 mil", amountCents: 100_000_00, tier: "prata" },
  { id: "1m", label: "R$ 1 milhão", amountCents: 1_000_000_00, tier: "ouro" },
  { id: "5m", label: "R$ 5 milhões", amountCents: 5_000_000_00, tier: "esmeralda" },
  { id: "10m", label: "R$ 10 milhões", amountCents: 10_000_000_00, tier: "esmeralda-escura" },
  { id: "25m", label: "R$ 25 milhões", amountCents: 25_000_000_00, tier: "onix" },
];

export interface MilestoneResult extends Milestone {
  achievedAt: Date | null;
}

export interface Achievements {
  totalCents: number;
  milestones: MilestoneResult[];
  /** Primeiro degrau ainda não conquistado, ou null se já bateu o último. */
  next: MilestoneResult | null;
  /** Base do progresso: 0 no degrau anterior, o valor do `next` no topo. */
  baseCents: number;
  progressPct: number;
}

export async function computeAchievements(): Promise<Achievements> {
  const sales = await db.sale.findMany({
    where: { status: { in: ["paid", "refunded", "chargeback"] } },
    orderBy: { occurredAt: "asc" },
    select: { amountCents: true, status: true, occurredAt: true },
  });

  let running = 0;
  const achievedAt = new Map<string, Date>();
  let cursor = 0;

  for (const s of sales) {
    running += s.status === "paid" ? s.amountCents : -s.amountCents;

    // conquista o(s) degrau(ns) que o acumulado ultrapassou nesta venda
    while (cursor < MILESTONES.length && running >= MILESTONES[cursor].amountCents) {
      achievedAt.set(MILESTONES[cursor].id, s.occurredAt);
      cursor++;
    }
  }

  const milestones: MilestoneResult[] = MILESTONES.map((m) => ({
    ...m,
    achievedAt: achievedAt.get(m.id) ?? null,
  }));

  const next = milestones.find((m) => !m.achievedAt) ?? null;
  const prevAmount = next
    ? (MILESTONES[MILESTONES.indexOf(next) - 1]?.amountCents ?? 0)
    : (MILESTONES[MILESTONES.length - 1]?.amountCents ?? 0);

  const progressPct = next
    ? Math.max(
        0,
        Math.min(100, ((running - prevAmount) / (next.amountCents - prevAmount)) * 100)
      )
    : 100;

  return { totalCents: running, milestones, next, baseCents: prevAmount, progressPct };
}
