import Link from "next/link";
import { historico, type Movimento } from "@/lib/history";

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
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Histórico</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {h.comparaveis} de {h.total} anúncios com mais de uma coleta no período
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map((d) => (
            <Link
              key={d}
              href={`/historico?dias=${d}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                days === d
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              {d} dias
            </Link>
          ))}
        </div>
      </div>

      {h.comparaveis === 0 && (
        <p className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          O histórico compara coletas do mesmo anúncio ao longo do tempo. Minere o mesmo
          nicho de novo em alguns dias para começar a ver movimento.
        </p>
      )}

      <div className="space-y-8">
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

function Secao({
  titulo,
  explica,
  itens,
  tom,
}: {
  titulo: string;
  explica: string;
  itens: Movimento[];
  tom: "up" | "down" | "dead" | "price" | "new";
}) {
  if (!itens.length) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-300">{titulo}</h2>
      <p className="mb-3 text-xs text-zinc-600">{explica}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {itens.map((m) => (
          <Link
            key={m.adId}
            href={`/ads/${m.adId}`}
            className="flex gap-3 rounded-xl border border-white/5 bg-ink-800 p-3 transition hover:border-gold-500/30"
          >
            {m.thumb ? (
              m.thumb.endsWith(".mp4") ? (
                <video src={media(m.thumb)} className="h-16 w-16 shrink-0 rounded-lg object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media(m.thumb)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              )
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-lg bg-ink-700" />
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-zinc-500">{m.advertiser}</div>
              <div className="line-clamp-2 text-sm text-zinc-200">
                {m.headline ?? "(sem headline)"}
              </div>

              <div className="mt-1 text-xs">
                {tom === "up" && (
                  <span className="text-emerald-400">
                    {m.variantesAntes} → {m.variantesAgora} variações (+{m.delta})
                  </span>
                )}
                {tom === "down" && (
                  <span className="text-orange-400">
                    {m.variantesAntes} → {m.variantesAgora} variações ({m.delta})
                  </span>
                )}
                {tom === "dead" && (
                  <span className="text-zinc-500">
                    inativo · chegou a {m.variantesAgora} variações
                  </span>
                )}
                {tom === "price" && (
                  <span className="text-gold-400">
                    {m.precoAntes} → {m.precoAgora}
                  </span>
                )}
                {tom === "new" && (
                  <span className="text-zinc-500">
                    escala {m.scaleScore} · {m.variantesAgora} variações
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
