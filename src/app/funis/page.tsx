import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Funis() {
  const funnels = await db.funnel.findMany({
    orderBy: { ad: { scaleScore: "desc" } },
    include: { ad: { include: { advertiser: true } } },
  });

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Funis</h1>
      <p className="mb-6 text-sm text-zinc-500">{funnels.length} destinos mapeados</p>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-ink-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Anunciante</th>
              <th className="px-4 py-3">Plataforma</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Destino</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {funnels.map((f) => (
              <tr key={f.id} className="bg-ink-800/40 hover:bg-ink-700/40">
                <td className="px-4 py-3 font-medium text-gold-400">{f.ad.scaleScore}</td>
                <td className="px-4 py-3">
                  <Link href={`/ads/${f.adId}`} className="hover:text-gold-400">
                    {f.ad.advertiser.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{f.platform}</td>
                <td className="px-4 py-3 text-emerald-400">{f.detectedPrice ?? ""}</td>
                <td className="max-w-md truncate px-4 py-3 text-zinc-500">{f.finalUrl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
