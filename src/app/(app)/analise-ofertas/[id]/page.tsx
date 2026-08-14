import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { card, btnSecondary } from "@/lib/ui";

export const dynamic = "force-dynamic";

interface Dia {
  data: Date;
  criativos: number;
}

/** Um ponto por dia: o último snapshot de cada dia representa o dia. */
function porDia(snapshots: { seenAt: Date; variantCount: number }[]): Dia[] {
  const mapa = new Map<string, Dia>();
  for (const s of snapshots) {
    mapa.set(s.seenAt.toISOString().slice(0, 10), { data: s.seenAt, criativos: s.variantCount });
  }
  return [...mapa.values()];
}

const dataBr = (d: Date) => d.toLocaleDateString("pt-BR");
const diaCurto = (d: Date) =>
  d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" }).replace(".", "");

/** Curva suave (quadráticas pelos pontos médios) + área preenchida. */
function AreaChart({ dias }: { dias: Dia[] }) {
  const W = 900;
  const H = 260;
  const PAD = 16;

  if (dias.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-white/[0.02] text-sm text-zinc-600">
        Precisa de pelo menos 2 coletas em dias diferentes para desenhar a evolução.
      </div>
    );
  }

  const max = Math.max(...dias.map((d) => d.criativos));
  const min = Math.min(...dias.map((d) => d.criativos), 0);
  const passo = (W - PAD * 2) / (dias.length - 1);
  const x = (i: number) => PAD + i * passo;
  const y = (v: number) => H - PAD - ((v - min) / Math.max(1, max - min)) * (H - PAD * 2 - 20);

  let linha = `M${x(0)},${y(dias[0].criativos)}`;
  for (let i = 1; i < dias.length; i++) {
    const xm = (x(i - 1) + x(i)) / 2;
    linha += ` Q${xm},${y(dias[i - 1].criativos)} ${xm},${(y(dias[i - 1].criativos) + y(dias[i].criativos)) / 2}`;
    linha += ` Q${xm},${y(dias[i].criativos)} ${x(i)},${y(dias[i].criativos)}`;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f88ff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#8f88ff" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={`${linha} L${x(dias.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`} fill="url(#area-grad)" />
        <path d={linha} fill="none" stroke="#8f88ff" strokeWidth="2.5" strokeLinecap="round" />
        {dias.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.criativos)} r="3.2" fill="#0d1017" stroke="#8f88ff" strokeWidth="2">
              <title>{`${dataBr(d.data)}: ${d.criativos} criativos`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-2 text-[10px] text-zinc-600">
        {dias.map((d, i) =>
          // no máximo ~7 rótulos para não virar sopa de letras
          dias.length <= 8 || i % Math.ceil(dias.length / 7) === 0 || i === dias.length - 1 ? (
            <span key={i}>{diaCurto(d.data)}</span>
          ) : (
            <span key={i} />
          )
        )}
      </div>
    </div>
  );
}

export default async function HistoricoMetricas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tracked = await db.trackedOffer.findUnique({
    where: { id },
    include: {
      ad: {
        include: {
          advertiser: true,
          snapshots: { orderBy: { seenAt: "asc" }, take: 120 },
        },
      },
    },
  });
  if (!tracked) notFound();

  const dias = porDia(tracked.ad.snapshots);
  const hoje = dias[dias.length - 1]?.criativos ?? tracked.ad.variantCount;
  const ontem = dias[dias.length - 2]?.criativos ?? null;

  const variacaoDiaria = ontem !== null ? hoje - ontem : null;
  const variacaoDiariaPct = ontem ? ((hoje - ontem) / ontem) * 100 : null;

  // variação semanal: contra o ponto mais próximo de 7 dias atrás
  const seteDias = Date.now() - 7 * 86_400_000;
  const base = [...dias].reverse().find((d) => d.data.getTime() <= seteDias) ?? dias[0];
  const variacaoSemanal = base && dias.length >= 2 ? hoje - base.criativos : null;

  const nome = tracked.ad.headline ?? tracked.ad.advertiser.name;

  // tabela: mais recente primeiro, com delta contra o dia anterior
  const linhas = dias
    .map((d, i) => {
      const prev = dias[i - 1]?.criativos ?? null;
      return {
        ...d,
        delta: prev !== null ? d.criativos - prev : 0,
        pct: prev ? ((d.criativos - prev) / prev) * 100 : 0,
      };
    })
    .reverse();

  const tone = (v: number) => (v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-zinc-500");
  const sinal = (v: number) => (v > 0 ? `+${v}` : String(v));

  return (
    <div className="px-10 py-9">
      <div className="mb-1 text-xs text-zinc-500">
        <Link href="/analise-ofertas" className="transition duration-200 ease-spring hover:text-gold-400">
          Análise de Ofertas
        </Link>
        <span className="mx-1.5 text-zinc-700">/</span>
        <span className="uppercase text-gold-400">{tracked.ad.advertiser.name}</span>
      </div>
      <h1 className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-50">Histórico de Métricas</h1>
      <p className="mb-6 text-[13px] uppercase tracking-wide text-zinc-500">{nome}</p>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card label="Total Hoje" valor={String(hoje)} />
        <Card
          label="Variação Diária"
          valor={
            variacaoDiariaPct === null
              ? "—"
              : `${variacaoDiariaPct > 0 ? "+" : ""}${variacaoDiariaPct.toFixed(2)}%`
          }
          cor={variacaoDiaria === null ? undefined : tone(variacaoDiaria)}
        />
        <Card
          label="Variação Semanal"
          valor={variacaoSemanal === null ? "—" : sinal(variacaoSemanal)}
          cor={variacaoSemanal === null ? undefined : tone(variacaoSemanal)}
        />
      </div>

      <section className={`mb-5 ${card} p-5`}>
        <h2 className="mb-4 text-sm font-medium text-zinc-200">Evolução dos Criativos</h2>
        <AreaChart dias={dias} />
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-4 text-sm font-medium text-zinc-200">Dados Históricos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Criativos</th>
                <th className="px-3 py-2">Variação</th>
                <th className="px-3 py-2">Variação %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {linhas.map((l) => (
                <tr key={l.data.toISOString()}>
                  <td className="px-3 py-2.5 text-zinc-400">{dataBr(l.data)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-zinc-100">{l.criativos}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${tone(l.delta)}`}>{sinal(l.delta)}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${tone(l.delta)}`}>
                    {l.pct > 0 ? "+" : ""}
                    {l.pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5">
        <Link href={`/ads/${tracked.adId}`} className={btnSecondary}>
          Ver anúncio completo →
        </Link>
      </div>
    </div>
  );
}

function Card({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className={`${card} p-5 text-center`}>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${cor ?? "text-zinc-100"}`}>{valor}</div>
    </div>
  );
}
