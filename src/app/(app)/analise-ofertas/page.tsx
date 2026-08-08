import Link from "next/link";
import { db } from "@/lib/db";
import { scaleLabel } from "@/lib/scale-score";
import TrackOfferButton from "@/components/TrackOfferButton";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

interface Ponto {
  seenAt: Date;
  variantCount: number;
  scaleScore: number;
  isActive: boolean;
}

/** subindo | caindo | estável | saiu do ar — comparando começo e fim da série. */
function tendencia(pontos: Ponto[]): { label: string; tone: string; delta: number } {
  const ultimo = pontos[pontos.length - 1];
  if (ultimo && !ultimo.isActive) return { label: "saiu do ar", tone: "text-red-400", delta: 0 };
  if (pontos.length < 2) return { label: "coletando dados", tone: "text-zinc-500", delta: 0 };

  const inicio = pontos[0].variantCount;
  const fim = ultimo.variantCount;
  const delta = fim - inicio;
  if (delta > 0) return { label: `escalando (+${delta} variações)`, tone: "text-emerald-400", delta };
  if (delta < 0) return { label: `reduzindo (${delta} variações)`, tone: "text-orange-400", delta };
  return { label: "estável", tone: "text-zinc-400", delta: 0 };
}

/** Sparkline em SVG puro: variações ao longo das coletas. */
function Sparkline({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length < 2) {
    return <div className="h-12 rounded-xl bg-white/[0.03] text-center text-[10px] leading-[48px] text-zinc-600">precisa de 2+ coletas</div>;
  }
  const W = 260;
  const H = 48;
  const max = Math.max(...pontos.map((p) => p.variantCount), 1);
  const passo = W / (pontos.length - 1);
  const y = (v: number) => H - 4 - (v / max) * (H - 10);
  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${(i * passo).toFixed(1)},${y(p.variantCount).toFixed(1)}`).join(" ");
  const subiu = pontos[pontos.length - 1].variantCount >= pontos[0].variantCount;
  const cor = subiu ? "#34d399" : "#fb923c";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" aria-hidden>
      <path d={`${linha} L${W},${H} L0,${H} Z`} fill={cor} opacity="0.12" />
      <path d={linha} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <circle key={i} cx={i * passo} cy={y(p.variantCount)} r="2.4" fill={cor} />
      ))}
    </svg>
  );
}

export default async function AnaliseOfertas() {
  const [tracked, sugestoes] = await Promise.all([
    db.trackedOffer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        ad: {
          include: {
            advertiser: true,
            funnel: true,
            creatives: { where: { localPath: { not: null } }, take: 1 },
            snapshots: { orderBy: { seenAt: "asc" }, take: 60 },
          },
        },
      },
    }),
    // candidatas: maiores scores ainda não acompanhados
    db.ad.findMany({
      where: { isActive: true, tracked: null },
      orderBy: { scaleScore: "desc" },
      take: 6,
      include: {
        advertiser: true,
        creatives: { where: { localPath: { not: null } }, take: 1 },
      },
    }),
  ]);

  return (
    <div className="p-8">
      <h1 className="mb-1 text-[28px] font-semibold tracking-tight text-zinc-100">Análise de Ofertas</h1>
      <p className="mb-6 text-[13px] text-zinc-500">
        Acompanhe ofertas específicas coleta a coleta: se as variações sobem, o concorrente está
        escalando; se caem, o criativo cansou. Minere o mesmo nicho de novo para gerar pontos novos.
      </p>

      {tracked.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
          Nenhuma oferta acompanhada ainda. Adicione uma das sugestões abaixo ou use o botão
          &quot;Acompanhar oferta&quot; na página de qualquer anúncio.
        </div>
      ) : (
        <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {tracked.map((t) => {
            const pontos: Ponto[] = t.ad.snapshots;
            const tend = tendencia(pontos);
            const escala = scaleLabel(t.ad.scaleScore);
            const thumb = t.ad.creatives[0]?.localPath;
            return (
              <div key={t.id} className={`${card} p-4`}>
                <div className="mb-3 flex items-start gap-3">
                  {thumb ? (
                    thumb.endsWith(".mp4") ? (
                      <video src={media(thumb)} className="h-14 w-14 shrink-0 rounded-xl object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media(thumb)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    )
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-ink-700" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/analise-ofertas/${t.id}`}
                      className="block truncate text-sm font-medium text-zinc-100 transition duration-200 ease-spring hover:text-gold-300"
                    >
                      {t.ad.advertiser.name}
                    </Link>
                    <div className="line-clamp-1 text-xs text-zinc-500">
                      {t.ad.headline ?? "(sem headline)"}
                    </div>
                    <div className={`mt-0.5 text-xs font-medium ${tend.tone}`}>{tend.label}</div>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold ${escala.tone}`}>{t.ad.scaleScore}</span>
                </div>

                <Sparkline pontos={pontos} />

                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>
                    {t.ad.variantCount}x variações
                    {t.ad.funnel?.detectedPrice && ` · ${t.ad.funnel.detectedPrice}`}
                    {` · ${pontos.length} coleta(s)`}
                  </span>
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/analise-ofertas/${t.id}`}
                      className="rounded-xl border border-gold-500/40 px-3 py-1.5 text-xs font-medium text-gold-400 transition duration-200 ease-spring hover:bg-gold-500/10 active:scale-[0.97]"
                    >
                      Ver métricas
                    </Link>
                    <TrackOfferButton adId={t.adId} trackedId={t.id} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sugestoes.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-zinc-100">Sugestões para acompanhar</h2>
          <p className="mb-3 text-xs text-zinc-600">
            Os maiores scores de escala do banco que ainda não estão na sua lista.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sugestoes.map((ad) => {
              const thumb = ad.creatives[0]?.localPath;
              return (
                <div key={ad.id} className={`flex items-center gap-3 ${card} p-3`}>
                  {thumb ? (
                    thumb.endsWith(".mp4") ? (
                      <video src={media(thumb)} className="h-12 w-12 shrink-0 rounded-xl object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media(thumb)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    )
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-ink-700" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-100">{ad.advertiser.name}</div>
                    <div className="text-xs text-zinc-500">
                      escala {ad.scaleScore} · {ad.variantCount}x variações
                    </div>
                  </div>
                  <TrackOfferButton adId={ad.id} trackedId={null} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
