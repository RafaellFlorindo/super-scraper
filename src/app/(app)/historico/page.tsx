import Link from "next/link";
import { historico, type Movimento } from "@/lib/history";
import { card, cardHover, pageTitle, pill } from "@/lib/ui";

export const dynamic = "force-dynamic";

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

const PERIODOS = [7, 14, 30, 90];

export default async function Historico({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias = "30" } = await searchParams;
  const days = Number(dias);
  const h = await historico(days);

  return (
    <div className="px-10 py-9">
      <header className="mb-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-3">Movimento do mercado</p>
            <h1 className={pageTitle}>Histórico</h1>
            <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-zinc-400">
              <span className="num text-zinc-300">{h.comparaveis}</span> de{" "}
              <span className="num text-zinc-300">{h.total}</span> anúncios com mais de uma
              coleta no período — só esses dá pra comparar no tempo.
            </p>
          </div>

          {/* segmentado: um trilho só, com a pílula acesa deslizando dentro —
              em vez de quatro botões soltos todos com o mesmo peso */}
          <div className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
            {PERIODOS.map((d) => (
              <Link
                key={d}
                href={`/historico?dias=${d}`}
                className={`num rounded-full px-3.5 py-1.5 text-xs transition duration-200 ease-spring active:scale-[0.97] ${
                  days === d
                    ? "bg-white/[0.09] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {d}d
              </Link>
            ))}
          </div>
        </div>

        <div className="hairline mt-8" />
      </header>

      {h.comparaveis === 0 && (
        <p className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          O histórico compara coletas do mesmo anúncio ao longo do tempo. Minere o mesmo
          nicho de novo em alguns dias para começar a ver movimento.
        </p>
      )}

      <div className="space-y-14">
        <Secao
          titulo="Escalando agora"
          explica="ganharam variações desde a primeira coleta, e o anunciante só produz variação do que vende"
          itens={h.subindo}
          tom="up"
        />
        <Secao
          titulo="Perdendo força"
          explica="cortaram variações, sinal de que o criativo cansou"
          itens={h.caindo}
          tom="down"
        />
        <Secao
          titulo="Saíram do ar"
          explica="estavam rodando e pararam; vale ver o que fizeram antes de morrer"
          itens={h.mortos}
          tom="dead"
        />
        <Secao
          titulo="Mudaram de preço"
          explica="o concorrente testou outro valor"
          itens={h.precoMudou}
          tom="price"
        />
        <Secao
          titulo="Novos no radar"
          explica="vistos numa coleta só, ainda sem comparação possível"
          itens={h.novos}
          tom="new"
        />
      </div>
    </div>
  );
}

type Tom = "up" | "down" | "dead" | "price" | "new";

/**
 * Cada seção tem UMA cor, e ela aparece em pouca coisa: o ponto aceso do
 * título e o número do delta no card. Antes a cor vinha em chip de fundo,
 * borda e ícone ao mesmo tempo, e cinco seções assim deixavam a tela sem
 * nenhum ponto de foco.
 */
const TONS: Record<Tom, { ponto: string; texto: string; hover: string }> = {
  up: {
    ponto: "bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]",
    texto: "text-emerald-400",
    hover: "hover:border-emerald-400/25",
  },
  down: {
    ponto: "bg-orange-400 shadow-[0_0_12px_2px_rgba(251,146,60,0.5)]",
    texto: "text-orange-400",
    hover: "hover:border-orange-400/25",
  },
  dead: {
    ponto: "bg-zinc-600",
    texto: "text-zinc-400",
    hover: "hover:border-white/15",
  },
  price: {
    ponto: "bg-sun-400 shadow-[0_0_12px_2px_rgba(232,194,100,0.5)]",
    texto: "text-sun-300",
    hover: "hover:border-sun-400/25",
  },
  new: {
    ponto: "bg-gold-400 shadow-[0_0_12px_2px_rgba(143,136,255,0.55)]",
    texto: "text-gold-300",
    hover: "hover:border-gold-400/25",
  },
};

function Secao({
  titulo,
  explica,
  itens,
  tom,
}: {
  titulo: string;
  explica: string;
  itens: Movimento[];
  tom: Tom;
}) {
  if (!itens.length) return null;
  const t = TONS[tom];

  return (
    <section>
      <div className="mb-5">
        <div className="flex items-baseline gap-3">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.ponto}`} />
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-zinc-100">
            {titulo}
          </h2>
          <span className="num text-xs text-zinc-400">
            {String(itens.length).padStart(2, "0")}
          </span>
          <div className="hairline ml-2 hidden flex-1 sm:block" />
        </div>
        <p className="mt-1.5 pl-[18px] text-xs leading-relaxed text-zinc-400">{explica}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {itens.map((m, i) => (
          <Link
            key={m.adId}
            href={`/ads/${m.adId}`}
            style={{ animationDelay: `${Math.min(i, 11) * 40}ms` }}
            className={`group flex animate-rise gap-3.5 p-3 ${card} ${cardHover} ${t.hover}`}
          >
            {m.thumb ? (
              m.thumb.endsWith(".mp4") ? (
                <video
                  src={media(m.thumb)}
                  className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                  muted
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media(m.thumb)}
                  alt=""
                  loading="lazy"
                  className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                />
              )
            ) : (
              <div className="h-[72px] w-[72px] shrink-0 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06]" />
            )}

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5 truncate text-[11px] text-zinc-400">
                <span className="truncate">{m.advertiser}</span>
                {m.outrosComEssaOferta > 0 && (
                  <span className={`${pill} num shrink-0 bg-white/[0.06] text-[10px] text-zinc-400`}>
                    +{m.outrosComEssaOferta}
                  </span>
                )}
              </div>

              <div className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-zinc-200 transition group-hover:text-white">
                {m.headline ?? "(sem headline)"}
              </div>

              <div className={`num mt-auto pt-1.5 text-xs ${t.texto}`}>
                {tom === "up" && (
                  <>
                    {m.variantesAntes} → {m.variantesAgora}{" "}
                    <span className="text-zinc-400">var</span> +{m.delta}
                  </>
                )}
                {tom === "down" && (
                  <>
                    {m.variantesAntes} → {m.variantesAgora}{" "}
                    <span className="text-zinc-400">var</span> {m.delta}
                  </>
                )}
                {tom === "dead" && (
                  <>
                    inativo <span className="text-zinc-400">· pico</span> {m.variantesAgora}
                  </>
                )}
                {tom === "price" && (
                  <>
                    {m.precoAntes} → {m.precoAgora}
                  </>
                )}
                {tom === "new" && (
                  <>
                    escala {m.scaleScore} <span className="text-zinc-400">·</span>{" "}
                    {m.variantesAgora} <span className="text-zinc-400">var</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
