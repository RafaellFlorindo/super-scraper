import Link from "next/link";
import MinePanel from "@/components/MinePanel";
import ModelButton from "@/components/ModelButton";
import { db } from "@/lib/db";
import { scaleLabel } from "@/lib/scale-score";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string; niche?: string; format?: string; min?: string; tipo?: string; ordem?: string;
  }>;
}

/** 24h: janela do que conta como "recém-minerado" para o selo NOVO. */
const JANELA_NOVO = 24 * 3600 * 1000;

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const ordem = sp.ordem === "recentes" ? "recentes" : "escala";

  // "tipo" default = só infoproduto. Sem isso o banco vira lista de escola de
  // bairro, que é o que a busca por palavra-chave traz na Ad Library.
  const tipo = sp.tipo ?? "info";

  const where: Prisma.AdWhereInput = {
    ...(tipo === "info" ? { isInfoproduct: true } : {}),
    ...(tipo === "local" ? { isInfoproduct: false } : {}),
    ...(sp.q ? { OR: [
      { primaryText: { contains: sp.q } },
      { headline: { contains: sp.q } },
      { advertiser: { name: { contains: sp.q } } },
    ] } : {}),
    ...(sp.niche ? { niche: sp.niche } : {}),
    ...(sp.format ? { format: sp.format } : {}),
    ...(sp.min ? { scaleScore: { gte: Number(sp.min) } } : {}),
  };

  const [ads, total, infoTotal, niches, formats] = await Promise.all([
    db.ad.findMany({
      where,
      orderBy: ordem === "recentes" ? { createdAt: "desc" } : { scaleScore: "desc" },
      take: 60,
      include: { advertiser: true, creatives: true, funnel: true },
    }),
    db.ad.count(),
    db.ad.count({ where: { isInfoproduct: true } }),
    db.ad.groupBy({ by: ["niche"], where: { niche: { not: null } }, _count: true }),
    db.ad.groupBy({ by: ["format"], where: { format: { not: null } }, _count: true }),
  ]);

  return (
    <div className="p-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Banco de Anúncios</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {infoTotal} infoprodutos de {total} anúncios minerados · ordenados por score de escala
          </p>
        </div>
      </header>

      <MinePanel />

      <form className="mb-6 flex flex-wrap gap-2">
        <select name="tipo" defaultValue={tipo} className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm">
          <option value="info">Só infoprodutos</option>
          <option value="local">Só negócio local</option>
          <option value="todos">Todos</option>
        </select>
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Buscar por texto, headline ou anunciante..."
          className="min-w-64 flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
        />
        <select name="niche" defaultValue={sp.niche ?? ""} className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm">
          <option value="">Todos os nichos</option>
          {niches.map((n) => (
            <option key={n.niche} value={n.niche!}>{n.niche} ({n._count})</option>
          ))}
        </select>
        <select name="format" defaultValue={sp.format ?? ""} className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm">
          <option value="">Todos os formatos</option>
          {formats.map((f) => (
            <option key={f.format} value={f.format!}>{f.format} ({f._count})</option>
          ))}
        </select>
        <select name="min" defaultValue={sp.min ?? ""} className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm">
          <option value="">Qualquer escala</option>
          <option value="25">Testando+ (25)</option>
          <option value="50">Escalando+ (50)</option>
          <option value="75">Escaladíssimo (75)</option>
        </select>
        <select name="ordem" defaultValue={ordem} className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm">
          <option value="escala">Maior escala</option>
          <option value="recentes">Minerados recentemente</option>
        </select>
        <button className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-medium text-ink-900 transition hover:bg-gold-400">
          Filtrar
        </button>
      </form>

      {ads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-16 text-center text-zinc-500">
          <p className="mb-2">Nenhum anúncio encontrado com esses filtros.</p>
          <p className="text-xs text-zinc-600">
            {tipo === "info"
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
              <div
                key={ad.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/5 bg-ink-800 transition hover:border-gold-500/30"
              >
                <Link href={`/ads/${ad.id}`} className="relative flex aspect-video items-center justify-center bg-ink-700">
                  {thumb ? (
                    thumb.kind === "video" ? (
                      <video src={`/api/media/${thumb.localPath!.replaceAll("\\", "/")}`} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/media/${thumb.localPath!.replaceAll("\\", "/")}`} alt="" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <span className="text-xs text-zinc-600">sem mídia baixada</span>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-ink-900/90 px-2 py-1 text-xs font-medium">
                    <span className={tone}>{ad.scaleScore}</span>{" "}
                    <span className="text-zinc-500">{label}</span>
                  </span>
                  {ad.variantCount > 1 && (
                    <span className="absolute right-2 top-2 rounded-md bg-ink-900/90 px-2 py-1 text-xs text-gold-400">
                      {ad.variantCount}x variações
                    </span>
                  )}
                  {Date.now() - ad.createdAt.getTime() < JANELA_NOVO && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-emerald-500/90 px-2 py-1 text-xs font-medium text-ink-900">
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
                  <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
                    {ad.isInfoproduct && (
                      <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">
                        infoproduto {ad.infoScore}
                      </span>
                    )}
                    {ad.niche && <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">{ad.niche}</span>}
                    {ad.format && <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">{ad.format}</span>}
                    {ad.funnel?.platform && ad.funnel.platform !== "proprio" && (
                      <span className="rounded bg-gold-500/10 px-1.5 py-0.5 text-gold-400">{ad.funnel.platform}</span>
                    )}
                    {ad.funnel?.detectedPrice && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">{ad.funnel.detectedPrice}</span>
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
