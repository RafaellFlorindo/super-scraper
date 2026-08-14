import Link from "next/link";
import MedalIcon from "./MedalIcon";
import type { Achievements } from "@/lib/achievements";

/** Compacto pra caber na pílula do cabeçalho: 7,1mil em vez de 7.100. */
function compacto(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}mil`;
  return `${n}`;
}

/** Pílula de progresso no cabeçalho, linkando para a lista completa em Meu Perfil. */
export default function AchievementsWidget({ data }: { data: Achievements }) {
  const alvo = data.next ?? data.milestones[data.milestones.length - 1];

  return (
    <Link
      href="/perfil"
      className="flex items-center gap-2.5 rounded-full border border-white/10 bg-ink-800 py-1.5 pl-1.5 pr-3 transition duration-200 ease-spring hover:border-emerald-500/40 active:scale-[0.97]"
      title="Caminho de mineração"
    >
      <MedalIcon tier={alvo.tier} achieved={Boolean(alvo.achievedAt)} size={22} />
      <div className="flex flex-col items-start leading-tight">
        <span className="num text-[11px] font-medium text-zinc-100">
          {compacto(data.total)}
          <span className="text-zinc-400"> / {compacto(alvo.count)}</span>
        </span>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${data.progressPct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
