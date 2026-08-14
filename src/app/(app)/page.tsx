import { Suspense } from "react";
import Link from "next/link";
import MinePanel from "@/components/MinePanel";
import ModelButton from "@/components/ModelButton";
import AdFilters from "@/components/AdFilters";
import LazyThumb from "@/components/LazyThumb";
import { db } from "@/lib/db";
import { scaleLabel } from "@/lib/scale-score";
import { card, cardHover, linkGhost, pageTitle, pill, pillFloating } from "@/lib/ui";
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
    <div className="px-10 py-9">
      <header className="mb-8">
        <p className="eyebrow mb-3">Biblioteca de anúncios · Meta</p>
        <h1 className={pageTitle}>Banco de Anúncios</h1>

        {/* números soltos na linha, separados por fio vertical: lê como painel
            de terminal, e não como mais três caixas iguais na tela */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <span className="text-zinc-400">
            <span className="num text-base text-zinc-50">{infoTotal}</span>{" "}
            <span className="text-zinc-400">infoprodutos/SaaS</span>
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-zinc-400">
            <span className="num text-base text-zinc-50">{total}</span>{" "}
            <span className="text-zinc-400">minerados</span>
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-zinc-400">
            {runFiltro ? "ordem: mais recente" : "ordem: score de escala"}
          </span>
          {aguardandoMidia > 0 && (
            <>
              <span className="h-3 w-px bg-white/10" />
              <span className="flex items-center gap-1.5 text-gold-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400 shadow-[0_0_10px_2px_rgba(143,136,255,0.6)]" />
                <span className="num">{aguardandoMidia}</span> aguardando mídia
              </span>
            </>
          )}
        </div>

        <div className="hairline mt-7" />
      </header>

      <MinePanel />

      {runAtual && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/25 bg-gold-500/[0.07] px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-gold-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_10px_2px_rgba(143,136,255,0.6)]" />
            Mostrando a coleta &quot;{runAtual.query}&quot; ({runAtual.country}) ·{" "}
            <span className="num">{runAtual.novos}</span> anúncios novos
          </span>
          <Link href="/" className={`ml-auto ${linkGhost}`}>
            limpar filtro de coleta
          </Link>
        </div>
      )}

      <div className={`mb-8 p-4 ${card}`}>
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
          {ads.map((ad, i) => {
            const { label, tone } = scaleLabel(ad.scaleScore);
            const thumb = ad.creatives.find((c) => c.localPath);
            const novo = Date.now() - ad.createdAt.getTime() < JANELA_NOVO;
            return (
              <div
                key={ad.id}
                style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}
                className={`group flex animate-rise flex-col overflow-hidden ${card} ${cardHover}`}
              >
                <Link href={`/ads/${ad.id}`} className="relative flex aspect-video items-center justify-center bg-black/40">
                  {thumb ? (
                    <LazyThumb
                      src={`/api/media/${thumb.localPath!.replaceAll("\\", "/")}`}
                      kind={thumb.kind === "video" ? "video" : "image"}
                    />
                  ) : (
                    <span className="text-xs text-zinc-600">sem mídia baixada</span>
                  )}

                  {/* sombra na base da mídia: o texto abaixo não fica "colado"
                      num corte reto de imagem */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-800 to-transparent" />

                  {/* score é o número que manda na tela: grande, em mono */}
                  <span className={`absolute left-2.5 top-2.5 ${pillFloating} flex items-center gap-1.5 py-1`}>
                    <span className={`num text-[13px] font-semibold leading-none ${tone}`}>
                      {ad.scaleScore}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
                  </span>

                  {ad.variantCount > 1 && (
                    <span className={`absolute right-2.5 top-2.5 ${pillFloating} num text-gold-300`}>
                      {ad.variantCount}×
                    </span>
                  )}
                  {novo && (
                    <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]" />
                      novo
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <Link href={`/ads/${ad.id}`} className="mb-1 block truncate text-[11px] text-zinc-400">
                    {ad.advertiser.name}
                  </Link>
                  <Link
                    href={`/ads/${ad.id}`}
                    className="mb-3 line-clamp-2 text-[13px] font-medium leading-snug text-zinc-100 transition group-hover:text-white"
                  >
                    {ad.headline ?? ad.primaryText ?? "(sem título)"}
                  </Link>

                  {/* nicho/formato viram texto corrido separado por ponto —
                      como pílula, cinco chips de peso igual viravam ruído e
                      empurravam o preço, que é o dado que importa, pro meio */}
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-zinc-400">
                    {ad.niche && <span className="truncate">{ad.niche}</span>}
                    {ad.niche && ad.format && <span className="text-zinc-500">·</span>}
                    {ad.format && <span>{ad.format}</span>}
                    {ad.funnel?.platform && ad.funnel.platform !== "proprio" && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span>{ad.funnel.platform}</span>
                      </>
                    )}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {ad.funnel?.detectedPrice && (
                      <span className={`${pill} num bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20`}>
                        {ad.funnel.detectedPrice}
                      </span>
                    )}
                    {ad.isInfoproduct && (
                      <span className={`${pill} num bg-white/[0.06] text-zinc-400`}>
                        info {ad.infoScore}
                      </span>
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
