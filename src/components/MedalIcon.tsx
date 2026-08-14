import type { Tier } from "@/lib/achievements";

/**
 * Cores por degrau. As três primeiras imitam medalha (bronze/prata/ouro); as
 * três últimas imitam gema, como a referência da Kiwify faz para os valores
 * mais altos. Não são cores de gráfico (sem regra de daltonismo a validar
 * aqui) — são identidade visual de conquista, sempre acompanhadas do rótulo
 * escrito ao lado, nunca só a cor.
 *
 * O degrau ainda não conquistado continua COLORIDO (só um pouco mais apagado):
 * a versão cinza deixava a lista inteira sem vida quando o usuário estava
 * começando, que é exatamente quando ela mais precisa motivar.
 */
const CORES: Record<Tier, { a: string; b: string; anel: string; brilho: string }> = {
  // degraus 1-4: medalha (fita + disco), como pódio de verdade
  bronze: { a: "#e09455", b: "#8a5227", anel: "#f5b878", brilho: "#ffd9ad" },
  prata: { a: "#dfe3e8", b: "#8a9096", anel: "#f2f4f6", brilho: "#ffffff" },
  ouro: { a: "#f2cf6e", b: "#a5791f", anel: "#ffe49a", brilho: "#fff3cd" },
  platina: { a: "#eef2f5", b: "#a9b4bd", anel: "#ffffff", brilho: "#ffffff" },
  // degraus 5+: gema, subindo em raridade até o topo
  turquesa: { a: "#4fd8d1", b: "#1a8f8a", anel: "#8ff0ea", brilho: "#d4fbf8" },
  esmeralda: { a: "#22c98d", b: "#0f7a54", anel: "#5fe3b3", brilho: "#a9f5d8" },
  jade: { a: "#5fbf7a", b: "#276b3e", anel: "#93d9a8", brilho: "#d3f3dc" },
  safira: { a: "#4f8ef7", b: "#1b3f96", anel: "#8fb6ff", brilho: "#d3e3ff" },
  ametista: { a: "#a370f0", b: "#5b2a94", anel: "#c9a6ff", brilho: "#ecdcff" },
  rubi: { a: "#f0466e", b: "#8f0f2f", anel: "#ff8fa8", brilho: "#ffd0db" },
  topazio: { a: "#f7a83f", b: "#a35a0a", anel: "#ffcb85", brilho: "#ffe7c2" },
  "quartzo-rosa": { a: "#f6b8d0", b: "#c46a92", anel: "#ffe0ec", brilho: "#fff2f7" },
  opala: { a: "#d9c6f0", b: "#8a7bb0", anel: "#f0e6ff", brilho: "#ffffff" },
  // 150k é rubi escuro, por pedido de manter o vermelho profundo no meio da
  // escada — não é retrabalho do rubi de 25k, é deliberadamente mais escuro
  "esmeralda-escura": { a: "#ef5350", b: "#8f1d22", anel: "#ff8a8d", brilho: "#ffc2c3" },
  diamante: { a: "#bfe9ff", b: "#4fa8d8", anel: "#e8f9ff", brilho: "#ffffff" },
  obsidiana: { a: "#3a3550", b: "#141225", anel: "#6a5f99", brilho: "#b9adf0" },
  onix: { a: "#b06bff", b: "#6b21a8", anel: "#cf9bff", brilho: "#ead1ff" },
  // topo absoluto: sem cor única, gradiente multi-tom pra parecer prisma de luz
  prisma: { a: "#ffd166", b: "#ef476f", anel: "#ffffff", brilho: "#ffffff" },
};

/** Degraus 1-4 são medalha de pódio; do 5º em diante viram gema — a coleção
 * fica visualmente maior conforme sobe, sem repetir a mesma forma 18 vezes. */
const MEDALHA: Set<Tier> = new Set(["bronze", "prata", "ouro", "platina"]);

export default function MedalIcon({
  tier,
  achieved,
  size = 28,
}: {
  tier: Tier;
  achieved: boolean;
  size?: number;
}) {
  const c = CORES[tier];
  const gradId = `medal-${tier}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={achieved ? "drop-shadow-[0_0_6px_rgba(232,194,100,0.25)]" : "opacity-60"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="1" stopColor={c.b} />
        </linearGradient>
      </defs>
      {!MEDALHA.has(tier) ? (
        // gema: losango facetado com facetas e brilho
        <>
          <path
            d="M16 2 27 12 16 30 5 12Z"
            fill={`url(#${gradId})`}
            stroke={c.anel}
            strokeWidth="1.2"
          />
          <path d="M16 2 21.5 12 16 30 10.5 12Z" fill={c.a} opacity="0.35" />
          <path d="M5 12h22" stroke={c.anel} strokeWidth="0.8" opacity="0.5" />
          <path d="M9 7.5 12.5 6" stroke={c.brilho} strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
        </>
      ) : (
        // medalha: fita, disco com anel duplo e brilho de canto
        <>
          <path d="M11 2h4l-2.2 8h-2.4Z" fill={c.b} stroke={c.anel} strokeWidth="0.8" />
          <path d="M17 2h4l-1.4 8h-2.4Z" fill={c.a} stroke={c.anel} strokeWidth="0.8" />
          <circle cx="16" cy="18.5" r="11" fill={`url(#${gradId})`} stroke={c.anel} strokeWidth="1.4" />
          <circle cx="16" cy="18.5" r="7" fill="none" stroke={c.anel} strokeWidth="1" opacity="0.65" />
          <path
            d="M16 13.5 17.4 16.6l3.3.4-2.5 2.3.7 3.3-2.9-1.7-2.9 1.7.7-3.3-2.5-2.3 3.3-.4Z"
            fill={c.brilho}
            opacity="0.9"
          />
          <path d="M9.5 12.5 12 11" stroke={c.brilho} strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
        </>
      )}
    </svg>
  );
}
