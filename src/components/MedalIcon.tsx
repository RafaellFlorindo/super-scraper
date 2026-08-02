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
  bronze: { a: "#e09455", b: "#8a5227", anel: "#f5b878", brilho: "#ffd9ad" },
  prata: { a: "#dfe3e8", b: "#8a9096", anel: "#f2f4f6", brilho: "#ffffff" },
  ouro: { a: "#f2cf6e", b: "#a5791f", anel: "#ffe49a", brilho: "#fff3cd" },
  esmeralda: { a: "#22c98d", b: "#0f7a54", anel: "#5fe3b3", brilho: "#a9f5d8" },
  "esmeralda-escura": { a: "#12a06e", b: "#075038", anel: "#22c98d", brilho: "#5fe3b3" },
  onix: { a: "#4d4d55", b: "#141416", anel: "#8a8a94", brilho: "#c9c9d2" },
};

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
      {tier === "onix" || tier === "esmeralda" || tier === "esmeralda-escura" ? (
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
