import Link from "next/link";
import { ofertasEstimadas } from "@/lib/funnel-hacking";
import { scaleLabel } from "@/lib/scale-score";
import { card, pill } from "@/lib/ui";

export const dynamic = "force-dynamic";

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const FAIXAS = [
  { id: "", label: "Todo mundo" },
  { id: "25", label: "Testando+ (25+)" },
  { id: "50", label: "Escalando+ (50+)" },
  { id: "75", label: "🔥 Escaladíssimo (75+)" },
];

export default async function FunilHacking({
  searchParams,
}: {
  searchParams: Promise<{ score?: string }>;
}) {
  const { score = "" } = await searchParams;
  const minScore = Number(score) || 0;

  const ofertas = await ofertasEstimadas({ minScore });
  const comPreco = ofertas.filter((o) => o.price);

  return (
    <div className="px-10 py-9">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-50">Funil Hacking</h1>
        <span className={`${pill} bg-gold-500/15 uppercase tracking-wide text-gold-400`}>
          estimativa
        </span>
      </div>
      <p className="mb-6 text-[13px] text-zinc-500">
        Quanto os concorrentes podem estar faturando, estimado a partir do quão escalado está o
        anúncio (variações, tempo no ar, amplitude) e do preço detectado no funil. A Ad Library
        não revela vendas nem gasto de ninguém — isto ordena quem vale estudar primeiro, não é
        uma medição.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {FAIXAS.map((f) => (
          <Link
            key={f.id}
            href={`/funil-hacking${f.id ? `?score=${f.id}` : ""}`}
            className={`rounded-xl px-3 py-1.5 text-sm transition duration-200 ease-spring active:scale-[0.97] ${
              score === f.id
                ? "bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/30"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {ofertas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-sm text-zinc-500">
          Nenhum anunciante nessa faixa de score ainda.
        </div>
      ) : (
        <>
          {comPreco.length === 0 && (
            <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
              Nenhum desses anúncios tem preço detectado ainda — a análise de funil roda em
              segundo plano. Sem preço não dá pra estimar faturamento, só o score de escala.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {ofertas.map((o) => {
              const escala = scaleLabel(o.scaleScore);
              return (
                <Link
                  key={o.advertiserId}
                  href={`/ads/${o.adId}`}
                  className={`group flex gap-3 ${card} p-4 transition duration-200 ease-spring hover:-translate-y-0.5 hover:border-gold-500/30 hover:shadow-apple`}
                >
                  {o.thumb ? (
                    o.thumb.endsWith(".mp4") ? (
                      <video src={media(o.thumb)} className="h-20 w-20 shrink-0 rounded-xl object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media(o.thumb)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                    )
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-ink-700" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-100">
                          {o.advertiser}
                        </div>
                        <div className="line-clamp-1 text-xs text-zinc-500">
                          {o.headline ?? "(sem headline)"}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-medium ${escala.tone}`}>
                        {o.scaleScore}
                      </span>
                    </div>

                    {o.price ? (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-600">
                          Faturamento estimado / mês
                          <span
                            className={`rounded-full px-1.5 py-0.5 normal-case tracking-normal ${
                              o.confianca === "alta"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : o.confianca === "media"
                                ? "bg-gold-500/15 text-gold-400"
                                : "bg-white/5 text-zinc-500"
                            }`}
                            title={
                              o.confianca === "alta"
                                ? "Preço lido direto da página de vendas e anúncio acompanhado em 3+ coletas"
                                : o.confianca === "media"
                                ? "Preço lido da página de vendas, mas ainda com poucas coletas"
                                : "Preço estimado só pelo texto do anúncio — menos confiável"
                            }
                          >
                            confiança {o.confianca}
                          </span>
                        </div>
                        <div className="text-base font-semibold text-emerald-400">
                          {brl(o.faturamentoMesBaixo)} – {brl(o.faturamentoMesAlto)}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-zinc-600">preço não detectado</div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span>{o.variantCount}x variações</span>
                      {o.activeAds > 1 && (
                        <span className="text-gold-400/80">{o.activeAds} anúncios ativos</span>
                      )}
                      {o.price && <span>ticket {brl(o.price)}</span>}
                      {o.diasNoAr !== null && <span>{o.diasNoAr}d no ar</span>}
                      {o.platform && <span className="text-zinc-400">{o.platform}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
