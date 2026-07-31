/**
 * Score 0-100 de "quão escalado está este anúncio".
 *
 * A Ad Library não expõe gasto nem resultado para anúncios comerciais. Então
 * inferimos a partir do comportamento do anunciante, que é observável:
 *
 *  1. VARIAÇÕES — ninguém produz 15 criativos do mesmo anúncio para uma oferta
 *     que não converte. É o sinal mais forte que existe. Peso 45.
 *  2. LONGEVIDADE — anúncio de infoproduto que sobrevive 30+ dias está pagando
 *     o tráfego. A grande maioria morre em menos de 7 dias. Peso 30.
 *  3. AMPLITUDE — rodar em várias plataformas/países indica orçamento grande.
 *     Peso 15.
 *  4. PERSISTÊNCIA — visto ativo em vários snapshots nossos ao longo do tempo,
 *     sem sumir. Confirma que 1 e 2 não foram um pico. Peso 10.
 *
 * É uma estimativa, não uma medição. Serve para ordenar a lista, não para
 * afirmar faturamento.
 */

export interface ScaleInput {
  variantCount: number;
  startedAt?: Date | null;
  platforms: string[];
  countries: string[];
  /** Quantos snapshots nossos viram este anúncio ativo. */
  activeSnapshots?: number;
}

/** Curva log: sair de 1→5 variações importa muito mais que de 30→35. */
function logScale(value: number, saturationPoint: number): number {
  if (value <= 1) return 0;
  return Math.min(1, Math.log(value) / Math.log(saturationPoint));
}

export function computeScaleScore(input: ScaleInput): number {
  const variants = logScale(input.variantCount, 20) * 45;

  const days = input.startedAt
    ? (Date.now() - input.startedAt.getTime()) / 86_400_000
    : 0;
  // 60 dias no ar satura a pontuação de longevidade
  const longevity = Math.min(1, days / 60) * 30;

  const breadth =
    (Math.min(1, input.platforms.length / 4) * 0.6 +
      Math.min(1, input.countries.length / 5) * 0.4) *
    15;

  const persistence = Math.min(1, (input.activeSnapshots ?? 0) / 14) * 10;

  return Math.round(variants + longevity + breadth + persistence);
}

/** Rótulo legível para a UI. */
export function scaleLabel(score: number): { label: string; tone: string } {
  if (score >= 75) return { label: "Escaladíssimo", tone: "text-emerald-400" };
  if (score >= 50) return { label: "Escalando", tone: "text-yellow-400" };
  if (score >= 25) return { label: "Testando", tone: "text-orange-400" };
  return { label: "Novo", tone: "text-zinc-500" };
}
