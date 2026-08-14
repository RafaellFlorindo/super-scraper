import { Suspense } from "react";
import Link from "next/link";
import MinePanel from "@/components/MinePanel";
import ModelButton from "@/components/ModelButton";
import AdFilters from "@/components/AdFilters";
import LazyThumb from "@/components/LazyThumb";
import { db } from "@/lib/db";
import { scaleLabel } from "@/lib/scale-score";
import { card, cardHover, linkGhost, pill, pillFloating } from "@/lib/ui";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string; niche?: string; format?: string; min?: string; tipo?: string; ordem?: string; run?: string;
  }>;
}

/** 24h: janela do que conta como "recém-minerado" para o selo NOVO. */
const JANELA_NOVO = 24 * 3600 * 1000;

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const ordem = sp.ordem === "recentes" ? "recentes" : "escala";
  const runFiltro = sp.run || "";

  // "tipo" default = só infoproduto. Sem isso o banco vira lista de escola de
  // bairro, que é o que a busca por palavra-chave traz na Ad Library.
  //
  // Exceção: ao filtrar por uma coleta específica, o padrão vira "todos". Um
  // anúncio recém-minerado nasce com isInfoproduct=false até o job de funil
  // rodar, então manter o filtro de infoproduto ligado faria a coleta inteira
  // sumir da tela sem nenhum aviso — foi exatamente o que pareceu bug.
  const tipo = sp.tipo ?? (runFiltro ? "todos" : "info");

  const where: Prisma.AdWhereInput = {
    ...(tipo === "info" ? { isInfoproduct: true } : {}),
    ...(tipo === "local" ? { isInfoproduct: false } : {}),
    ...(runFiltro ? { firstRunId: runFiltro } : {}),
    ...(sp.q ? { OR: [
      { primaryText: { contains: sp.q } },
      { headline: { contains: sp.q } },
      { advertiser: { name: { contains: sp.q } } },
    ] } : {}),
    ...(sp.niche ? { niche: sp.niche } : {}),
    ...(sp.format ? { format: sp.format } : {}),
    ...(sp.min ? { scaleScore: { gte: Number(sp.min) } } : {}),
    // só mostra o card depois que pelo menos uma mídia baixou: um anúncio
    // recém-minerado fica com creatives sem localPath por um tempo (o download
    // é assíncrono, no worker), e mostrar isso na grade parecia card quebrado
    creatives: { some: { localPath: { not: null } } },
  };

  const [ads, total, infoTotal, aguardandoMidia, niches, formats, runs] = await Promise.all([
    db.ad.findMany({
      where,
      // dentro de uma coleta específica, "recém-chegado" já é a própria seleção:
      // faz mais sentido ver por ordem de descoberta do que enterrar tudo
      // atrás do score, que muitos ainda nem têm calculado direito
      orderBy:
        ordem === "recentes" || runFiltro ? { createdAt: "desc" } : { scaleScore: "desc" },
      take: 60,
      include: { advertiser: true, creatives: true, funnel: true },
    }),
    db.ad.count(),
    db.ad.count({ where: { isInfoproduct: true } }),
    db.ad.count({ where: { creatives: { none: { localPath: { not: null } } } } }),
    db.ad.groupBy({ by: ["niche"], where: { niche: { not: null } }, _count: true }),
    db.ad.groupBy({ by: ["format"], where: { format: { not: null } }, _count: true }),
    db.miningRun.findMany({
      where: { status: "done" },
      orderBy: { startedAt: "desc" },
      take: 15,
      select: { id: true, query: true, country: true, novos: true, startedAt: true },
    }),
  ]);

  const runAtual = runFiltro ? runs.find((r) => r.id === runFiltro) : null;

  return (
    <div className="p-8">
      <div className="relative mb-6">
        <div
          className="pointer-events-none absolute -left-10 -top-20 -z-10 h-72 w-72 rounded-full bg-[#5b4fe0]/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-10 left-32 -z-10 h-56 w-56 rounded-full bg-sun-500/15 blur-3xl"
          aria-hidden
        />
        <header className="flex items-end justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-zinc-50 to-gold-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              Banco de Anúncios
            </h1>
            <p className="mt-1.5 text-[13px] text-zinc-500">
              {infoTotal} infoprodutos/SaaS de {total} anúncios minerados ·{" "}
              {runFiltro ? "ordenados por mais recente" : "ordenados por score de escala"}
              {aguardandoMidia > 0 && (
                <>
                  {" "}
                  · <span className="text-gold-400">{aguardandoMidia} aguardando mídia baixar</span>
                </>
              )}
            </p>
          </div>
        </header>
      </div>

      <MinePanel />

      {runAtual && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 px-4 py-2.5 text-sm">
          <span className="text-gold-400">
            Mostrando a coleta &quot;{runAtual.query}&quot; ({runAtual.country}) ·{" "}
            {runAtual.novos} anúncios novos
          </span>
          <Link href="/" className={`ml-auto ${linkGhost}`}>
            limpar filtro de coleta
          </Link>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-apple backdrop-blur-xl">
        <Suspense fallback={<div className="h-12" />}>
          <AdFilters
            niches={niches.map((n) => ({ value: n.niche!, label: `${n.niche} (${n._count})` }))}
            formats={formats.map((f) => ({ value: f.format!, label: `${f.format} (${f._count})` }))}
            runs={runs.map((r) => ({ value: r.id, label: `"${r.query}" (${r.novos} novos)` }))}
          />
        </Suspense>
      </div>

      {ads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center text-zinc-500">
          <p className="mb-2">Nenhum anúncio encontrado com esses filtros.</p>
          <p className="text-xs text-zinc-600">
            {aguardandoMidia > 0
              ? `${aguardandoMidia} anúncio(s) minerado(s) ainda estão baixando a mídia — eles aparecem aqui assim que tiverem vídeo/imagem prontos. Rode npm run worker se ele não estiver ligado.`
              : tipo === "info"
              ? "O filtro de infoproduto depende do funil ter sido analisado. Rode npm run worker."
              : "Minere um nicho no painel acima."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {ads.map((ad) => {
            const { label, tone } = scaleLabel(ad.scaleScore);
            const thumb = ad.creatives.find((c) => c.localPath);
            return (
              <div key={ad.id} className={`group flex flex-col overflow-hidden ${card} ${cardHover}`}>
                <Link href={`/ads/${ad.id}`} className="relative flex aspect-video items-center justify-center bg-ink-700">
                  {thumb ? (
                    <LazyThumb
                      src={`/api/media/${thumb.localPath!.replaceAll("\\", "/")}`}
                      kind={thumb.kind === "video" ? "video" : "image"}
                      className="h-full w-full"
                    />
                  ) : (
                    <span className="text-xs text-zinc-600">sem mídia baixada</span>
                  )}
                  <span className={`absolute left-2 top-2 ${pillFloating}`}>
                    <span className={tone}>{ad.scaleScore}</span>{" "}
                    <span className="text-zinc-500">{label}</span>
                  </span>
                  {ad.variantCount > 1 && (
                    <span className={`absolute right-2 top-2 ${pillFloating} text-gold-400`}>
                      {ad.variantCount}x variações
                    </span>
                  )}
                  {Date.now() - ad.createdAt.getTime() < JANELA_NOVO && (
                    <span className={`absolute bottom-2 left-2 ${pill} bg-emerald-500/90 text-ink-900`}>
                      novo
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <Link href={`/ads/${ad.id}`} className="mb-1 block truncate text-xs text-zinc-500">
                    {ad.advertiser.name}
                  </Link>
                  <Link
                    href={`/ads/${ad.id}`}
                    className="mb-3 line-clamp-2 text-sm font-medium text-zinc-200 hover:text-gold-400"
                  >
                    {ad.headline ?? ad.primaryText ?? "(sem título)"}
                  </Link>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {ad.isInfoproduct && (
                      <span className={`${pill} bg-violet-500/15 text-violet-300`}>infoproduto {ad.infoScore}</span>
                    )}
                    {ad.niche && <span className={`${pill} bg-white/5 text-zinc-400`}>{ad.niche}</span>}
                    {ad.format && <span className={`${pill} bg-white/5 text-zinc-400`}>{ad.format}</span>}
                    {ad.funnel?.platform && ad.funnel.platform !== "proprio" && (
                      <span className={`${pill} bg-gold-500/10 text-gold-400`}>{ad.funnel.platform}</span>
                    )}
                    {ad.funnel?.detectedPrice && (
                      <span className={`${pill} bg-emerald-500/10 text-emerald-400`}>{ad.funnel.detectedPrice}</span>
                    )}
                  </div>

                  <ModelButton adId={ad.id} className="mt-auto w-full" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
