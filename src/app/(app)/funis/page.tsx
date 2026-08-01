import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ORDENS = [
  { id: "recentes", label: "Analisados agora" },
  { id: "escala", label: "Maior escala" },
];

/** "agora", "há 3 min", "há 2 h", "há 4 d" */
function desde(data: Date): string {
  const min = Math.floor((Date.now() - data.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export default async function Funis({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>;
}) {
  const { ordem = "recentes" } = await searchParams;

  const [funnels, totalAds, semCta, pendentes, ultimo, totalFunis] = await Promise.all([
    db.funnel.findMany({
      orderBy: ordem === "escala" ? { ad: { scaleScore: "desc" } } : { analyzedAt: "desc" },
      take: 200,
      include: { ad: { include: { advertiser: true } } },
    }),
    db.ad.count(),
    db.ad.count({ where: { ctaUrl: null } }),
    db.job.count({ where: { kind: "funnel", status: { in: ["pending", "running"] } } }),
    db.funnel.findFirst({ orderBy: { analyzedAt: "desc" }, select: { analyzedAt: true } }),
    db.funnel.count(),
  ]);

  const analisaveis = totalAds - semCta;
  const progresso = analisaveis > 0 ? (totalFunis / analisaveis) * 100 : 0;

  // quantos entraram hoje: é o que responde "qual o dia mais atualizado"
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const doDia = await db.funnel.count({ where: { analyzedAt: { gte: hoje } } });

  return (
    <div className="p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Funis</h1>
          <p className="mt-1 text-sm text-zinc-500">Para onde cada anúncio manda o clique</p>
        </div>
        <div className="flex gap-1">
          {ORDENS.map((o) => (
            <Link
              key={o.id}
              href={`/funis?ordem=${o.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                ordem === o.id
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Estado da análise. Sem isto não dá para saber se a lista está completa
          ou se ainda tem centenas de anúncios esperando na fila. */}
      <div className="mb-6 rounded-xl border border-white/5 bg-ink-800 p-4">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Destinos mapeados" valor={String(totalFunis)} />
          <Info label="Analisados hoje" valor={String(doDia)} tom={doDia > 0 ? "bom" : undefined} />
          <Info label="Última análise" valor={ultimo ? desde(ultimo.analyzedAt) : "nunca"} />
          <Info label="Na fila" valor={String(pendentes)} tom={pendentes > 0 ? "aviso" : "bom"} />
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gold-500 transition-all"
            style={{ width: `${Math.min(100, progresso)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {totalFunis} de {analisaveis} anúncios com link já analisados
          {semCta > 0 && ` · ${semCta} sem link de destino, não dá para analisar`}
          {pendentes > 0 && (
            <>
              {" · "}
              <span className="text-gold-400">
                a fila continua enquanto o worker estiver ligado
              </span>
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-ink-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Anunciante</th>
              <th className="px-4 py-3">Plataforma</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3 text-right">Analisado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {funnels.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  Nenhum funil analisado ainda. Deixe o worker rodando.
                </td>
              </tr>
            ) : (
              funnels.map((f) => (
                <tr key={f.id} className="bg-ink-800/40 hover:bg-ink-700/40">
                  <td className="px-4 py-3 font-medium tabular-nums text-gold-400">
                    {f.ad.scaleScore}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/ads/${f.adId}`} className="hover:text-gold-400">
                      {f.ad.advertiser.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{f.platform}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-400">
                    {f.detectedPrice ?? ""}
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-zinc-500">{f.finalUrl}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-zinc-600">
                    {desde(f.analyzedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, valor, tom }: { label: string; valor: string; tom?: "bom" | "aviso" }) {
  const cor =
    tom === "bom" ? "text-emerald-400" : tom === "aviso" ? "text-gold-400" : "text-zinc-100";
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${cor}`}>{valor}</div>
    </div>
  );
}
