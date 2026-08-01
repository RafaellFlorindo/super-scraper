import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { scaleLabel } from "@/lib/scale-score";
import { classifyInfoproduct } from "@/lib/infoproduct";
import SaveToProject from "@/components/SaveToProject";
import ModelButton from "@/components/ModelButton";
import ScaleSparkline from "@/components/ScaleSparkline";
import CloneButton from "@/components/CloneButton";

export const dynamic = "force-dynamic";

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

export default async function AdDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await db.ad.findUnique({
    where: { id },
    include: { advertiser: true, creatives: true, funnel: true, snapshots: { orderBy: { seenAt: "asc" } } },
  });
  if (!ad) notFound();

  const [projects, savedIn] = await Promise.all([
    db.project.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true } }),
    db.savedAd.findMany({ where: { adId: id }, select: { projectId: true } }),
  ]);

  // Recalculado aqui só para exibir os motivos — o valor persistido é o mesmo.
  const info = classifyInfoproduct({
    ctaUrl: ad.ctaUrl,
    finalUrl: ad.funnel?.finalUrl,
    advertiserName: ad.advertiser.name,
    primaryText: ad.primaryText,
    headline: ad.headline,
    hasVideo: ad.creatives.some((c) => c.kind === "video"),
  });

  const { label, tone } = scaleLabel(ad.scaleScore);
  const platforms: string[] = JSON.parse(ad.platforms);
  const transcripts = ad.creatives.filter((c) => c.transcript);
  const days = ad.startedAt
    ? Math.floor((Date.now() - ad.startedAt.getTime()) / 86_400_000)
    : null;

  return (
    <div className="p-8">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Banco de Anúncios
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-500">{ad.advertiser.name}</div>
              <h1 className="mt-1 text-xl font-semibold text-zinc-100">
                {ad.headline ?? "(sem headline)"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* o anúncio vivo na Meta: mostra as variações lado a lado, o
                  período exato e o que o app não consegue capturar */}
              <a
                href={`https://www.facebook.com/ads/library/?id=${ad.libraryId}`}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:border-gold-500/40 hover:text-gold-400"
              >
                Ver na Ad Library
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                </svg>
              </a>
              <ModelButton adId={ad.id} />
            </div>
          </div>

          {/* uma peça só não vira grade: ficaria espremida em meia coluna */}
          <div
            className={`grid gap-4 ${
              ad.creatives.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {ad.creatives.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl border border-white/5 bg-ink-800">
                {c.localPath ? (
                  // Altura fixa com object-contain: criativo de anúncio é quase
                  // sempre vertical 9:16, e sem limite de altura um único vídeo
                  // ocupa a tela inteira e empurra o resto da página para baixo.
                  // O fundo preto preenche as laterais sem cortar a imagem.
                  <div
                    className={`flex items-center justify-center bg-black ${
                      ad.creatives.length > 1 ? "h-[420px]" : "h-[520px]"
                    }`}
                  >
                    {c.kind === "video" ? (
                      <video
                        src={media(c.localPath)}
                        controls
                        preload="metadata"
                        className="max-h-full max-w-full"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={media(c.localPath)}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-[420px] items-center justify-center text-xs text-zinc-600">
                    não baixado ainda
                  </div>
                )}
                {c.localPath && (
                  <a
                    href={media(c.localPath)}
                    download
                    className="block border-t border-white/5 py-2 text-center text-xs text-zinc-400 hover:text-gold-400"
                  >
                    Baixar {c.kind === "video" ? "vídeo" : "imagem"}
                  </a>
                )}
              </div>
            ))}
          </div>

          {ad.primaryText && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-400">Copy do anúncio</h2>
              <p className="whitespace-pre-wrap rounded-xl border border-white/5 bg-ink-800 p-4 text-sm leading-relaxed">
                {ad.primaryText}
              </p>
            </section>
          )}

          {transcripts.map((c) => (
            <section key={c.id}>
              <h2 className="mb-2 text-sm font-medium text-zinc-400">Transcrição da VSL</h2>
              <p className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-ink-800 p-4 text-sm leading-relaxed text-zinc-300">
                {c.transcript}
              </p>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
            <div className="mb-4 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${tone}`}>{ad.scaleScore}</span>
              <span className="text-sm text-zinc-500">{label}</span>
            </div>
            <dl className="space-y-2 text-sm">
              <Row k="Variações" v={`${ad.variantCount}x`} />
              <Row k="No ar há" v={days !== null ? `${days} dias` : ""} />
              <Row k="Plataformas" v={platforms.length ? platforms.join(", ").toLowerCase() : ""} />
              <Row k="Status" v={ad.isActive ? "ativo" : "inativo"} />
            </dl>

            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
                Evolução das variações
              </div>
              <ScaleSparkline
                pontos={ad.snapshots.map((s) => ({
                  seenAt: s.seenAt,
                  variantCount: s.variantCount,
                  isActive: s.isActive,
                }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
            <h3 className="mb-3 text-sm font-medium text-zinc-400">Usar como referência</h3>
            <SaveToProject
              adId={ad.id}
              projects={projects}
              saved={savedIn.map((s) => s.projectId)}
            />
          </div>

          <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-zinc-400">Infoproduto?</h3>
              <span className={ad.isInfoproduct ? "text-violet-300" : "text-zinc-500"}>
                {ad.isInfoproduct ? `sim · ${ad.infoScore}` : `não · ${ad.infoScore}`}
              </span>
            </div>
            <ul className="space-y-1 text-xs text-zinc-500">
              {info.reasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
              {info.reasons.length === 0 && <li>sem sinais fortes nos dois sentidos</li>}
            </ul>
          </div>

          <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
            <h3 className="mb-3 text-sm font-medium text-zinc-400">Classificação</h3>
            <dl className="space-y-2 text-sm">
              <Row k="Nicho" v={ad.niche ?? "não classificado"} />
              <Row k="Ângulo" v={ad.angle ?? ""} />
              <Row k="Formato" v={ad.format ?? ""} />
              <Row k="Preço na copy" v={ad.offerPrice ?? ""} />
            </dl>
          </div>

          <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
            <h3 className="mb-3 text-sm font-medium text-zinc-400">Funil</h3>
            {ad.funnel ? (
              <dl className="space-y-2 text-sm">
                <Row k="Plataforma" v={ad.funnel.platform ?? ""} />
                <Row k="Preço detectado" v={ad.funnel.detectedPrice ?? ""} />
                <div className="pt-1">
                  <a
                    href={ad.funnel.finalUrl ?? ad.ctaUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-xs text-gold-400 hover:underline"
                  >
                    {ad.funnel.finalUrl ?? ad.ctaUrl}
                  </a>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-zinc-600">funil ainda não analisado</p>
            )}

            {(ad.funnel?.finalUrl ?? ad.ctaUrl) && (
              <div className="mt-3 border-t border-white/5 pt-3">
                <CloneButton url={(ad.funnel?.finalUrl ?? ad.ctaUrl)!} adId={ad.id} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right text-zinc-200">{v}</dd>
    </div>
  );
}
