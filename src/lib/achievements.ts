/**
 * Caminho de vitórias por volume de mineração, no espírito das premiações da
 * Kiwify — só que sem Traqueamento não existe mais faturamento pra medir, e o
 * valor real do app sempre foi o tamanho do banco de anúncios. Marco é
 * vitalício: total de anúncios minerados desde sempre, não filtrado por
 * período.
 *
 * A data de conquista é real, não estimada: soma-se cada anúncio em ordem
 * cronológica de mineração e marca-se o instante exato em que o total
 * cruzou cada degrau.
 */
import { db } from "./db";

export type Tier = "bronze" | "prata" | "ouro" | "esmeralda" | "esmeralda-escura" | "onix";

export interface Milestone {
  id: string;
  label: string;
  count: number;
  tier: Tier;
}

/** Escada de volume: começa alcançável em poucos dias, termina num banco de verdade grande. */
export const MILESTONES: Milestone[] = [
  { id: "1000", label: "1.000 anúncios", count: 1_000, tier: "bronze" },
  { id: "10000", label: "10.000 anúncios", count: 10_000, tier: "prata" },
  { id: "50000", label: "50.000 anúncios", count: 50_000, tier: "ouro" },
  { id: "150000", label: "150.000 anúncios", count: 150_000, tier: "esmeralda" },
  { id: "500000", label: "500.000 anúncios", count: 500_000, tier: "esmeralda-escura" },
  { id: "1000000", label: "1.000.000 anúncios", count: 1_000_000, tier: "onix" },
];

export interface MilestoneResult extends Milestone {
  achievedAt: Date | null;
}

export interface Achievements {
  total: number;
  milestones: MilestoneResult[];
  /** Primeiro degrau ainda não conquistado, ou null se já bateu o último. */
  next: MilestoneResult | null;
  /** Base do progresso: 0 no degrau anterior, o valor do `next` no topo. */
  base: number;
  progressPct: number;
}

export async function computeAchievements(): Promise<Achievements> {
  const ads = await db.ad.findMany({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const achievedAt = new Map<string, Date>();
  let cursor = 0;

  ads.forEach((ad, i) => {
    const total = i + 1;
    while (cursor < MILESTONES.length && total >= MILESTONES[cursor].count) {
      achievedAt.set(MILESTONES[cursor].id, ad.createdAt);
      cursor++;
    }
  });

  const total = ads.length;
  const milestones: MilestoneResult[] = MILESTONES.map((m) => ({
    ...m,
    achievedAt: achievedAt.get(m.id) ?? null,
  }));

  const next = milestones.find((m) => !m.achievedAt) ?? null;
  const prevCount = next
    ? (MILESTONES[MILESTONES.indexOf(next) - 1]?.count ?? 0)
    : (MILESTONES[MILESTONES.length - 1]?.count ?? 0);

  const progressPct = next
    ? Math.max(0, Math.min(100, ((total - prevCount) / (next.count - prevCount)) * 100))
    : 100;

  return { total, milestones, next, base: prevCount, progressPct };
}
