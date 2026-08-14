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

export type Tier =
  | "bronze"
  | "prata"
  | "ouro"
  | "platina"
  | "turquesa"
  | "esmeralda"
  | "jade"
  | "safira"
  | "ametista"
  | "rubi"
  | "topazio"
  | "quartzo-rosa"
  | "opala"
  | "esmeralda-escura"
  | "diamante"
  | "obsidiana"
  | "onix"
  | "prisma";

export interface Milestone {
  id: string;
  label: string;
  count: number;
  tier: Tier;
}

/**
 * Escada de volume, com degraus curtos no começo (motiva desde o primeiro
 * dia) e mais espaçados no topo (o salto de 1k pra 10k pra 50k direto era
 * grande demais — 18 degraus deixam sempre uma próxima medalha por perto).
 */
export const MILESTONES: Milestone[] = [
  { id: "100", label: "100 anúncios", count: 100, tier: "bronze" },
  { id: "500", label: "500 anúncios", count: 500, tier: "prata" },
  { id: "1000", label: "1.000 anúncios", count: 1_000, tier: "ouro" },
  { id: "2000", label: "2.000 anúncios", count: 2_000, tier: "platina" },
  { id: "3500", label: "3.500 anúncios", count: 3_500, tier: "turquesa" },
  { id: "5000", label: "5.000 anúncios", count: 5_000, tier: "esmeralda" },
  { id: "7500", label: "7.500 anúncios", count: 7_500, tier: "jade" },
  { id: "10000", label: "10.000 anúncios", count: 10_000, tier: "safira" },
  { id: "15000", label: "15.000 anúncios", count: 15_000, tier: "ametista" },
  { id: "25000", label: "25.000 anúncios", count: 25_000, tier: "rubi" },
  { id: "40000", label: "40.000 anúncios", count: 40_000, tier: "topazio" },
  { id: "60000", label: "60.000 anúncios", count: 60_000, tier: "quartzo-rosa" },
  { id: "100000", label: "100.000 anúncios", count: 100_000, tier: "opala" },
  { id: "150000", label: "150.000 anúncios", count: 150_000, tier: "esmeralda-escura" },
  { id: "250000", label: "250.000 anúncios", count: 250_000, tier: "diamante" },
  { id: "400000", label: "400.000 anúncios", count: 400_000, tier: "obsidiana" },
  { id: "650000", label: "650.000 anúncios", count: 650_000, tier: "onix" },
  { id: "1000000", label: "1.000.000 anúncios", count: 1_000_000, tier: "prisma" },
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
