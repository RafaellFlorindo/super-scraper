import { db } from "@/lib/db";
import {
  campaignReport,
  creativeReport,
  resumo,
  porPagamento,
  opcoesFiltro,
  brl,
  pct,
  type Filtro,
} from "@/lib/tracking";
import { getSetting } from "@/lib/settings";
import SpendForm from "@/components/SpendForm";
import WebhookInfo from "@/components/WebhookInfo";
import PaymentDonut from "@/components/PaymentDonut";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export default async function Traqueamento({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; plataforma?: string; produto?: string; campanha?: string }>;
}) {
  const sp = await searchParams;
  const filtro: Filtro = {
    days: Number(sp.dias ?? 7),
    platform: sp.plataforma || undefined,
    product: sp.produto || undefined,
    campaign: sp.campanha || undefined,
  };

  const [r, pag, rows, creatives, opcoes, token, recent, failed] = await Promise.all([
    resumo(filtro),
    porPagamento(filtro),
    campaignReport(filtro),
    creativeReport(filtro),
    opcoesFiltro(),
    getSetting("WEBHOOK_TOKEN"),
    db.sale.findMany({ orderBy: { occurredAt: "desc" }, take: 10 }),
    db.webhookEvent.count({ where: { ok: false } }),
  ]);

  const semGasto = r.spendCents === 0;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Traqueamento</h1>
      <p className="mb-6 text-sm text-zinc-500">Vendas atribuídas por UTM</p>

      {/* filtros numa linha só, acima de tudo */}
      <form className="mb-6 rounded-xl border border-white/5 bg-ink-800 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="Período">
            <select name="dias" defaultValue={String(filtro.days)} className={INPUT}>
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Plataforma">
            <select name="plataforma" defaultValue={sp.plataforma ?? ""} className={INPUT}>
              <option value="">Qualquer</option>
              {opcoes.platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Produto">
            <select name="produto" defaultValue={sp.produto ?? ""} className={INPUT}>
              <option value="">Qualquer</option>
              {opcoes.products.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Campanha">
            <select name="campanha" defaultValue={sp.campanha ?? ""} className={INPUT}>
              <option value="">Todas</option>
              {opcoes.campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Campo>

          <div className="flex items-end">
            <button className="w-full rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-gold-400">
              Atualizar
            </button>
          </div>
        </div>
      </form>

      {/* linha 1: dinheiro que entra e sai */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Faturamento líquido"
          value={brl(r.netRevenueCents)}
          hint="pagas menos reembolso e chargeback"
        />
        <Kpi label="Gastos com anúncios" value={brl(r.spendCents)} hint="lançado por você" />
        <Kpi
          label="ROAS"
          value={r.roas ? r.roas.toFixed(2) : "sem gasto"}
          tone={r.roas === null ? "muted" : r.roas >= 1 ? "good" : "bad"}
          hint="faturamento dividido pelo investido"
        />
        <Kpi
          label="Lucro"
          value={brl(r.profitCents)}
          tone={r.profitCents >= 0 ? "good" : "bad"}
          hint="faturamento menos gasto e imposto"
        />
      </div>

      {/* linha 2: qualidade da operação */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vendas pendentes" value={brl(r.pendingCents)} hint="boleto e pix não pagos" />
        <Kpi
          label="ROI"
          value={r.roi === null ? "sem gasto" : pct(r.roi)}
          tone={r.roi === null ? "muted" : r.roi >= 0 ? "good" : "bad"}
          hint="lucro sobre o investido"
        />
        <Kpi
          label="Margem de lucro"
          value={r.marginPct === null ? "sem venda" : pct(r.marginPct)}
          tone={r.marginPct === null ? "muted" : r.marginPct >= 0 ? "good" : "bad"}
          hint="lucro sobre o faturamento"
        />
        <Kpi label="ARPU" value={brl(r.arpuCents)} hint="faturamento por comprador" />
      </div>

      {/* linha 3: perdas */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vendas reembolsadas" value={brl(r.refundedCents)} />
        <Kpi
          label="Reembolso"
          value={pct(r.refundPct)}
          tone={r.refundPct > 5 ? "bad" : "muted"}
          hint={`${r.refundCount} de ${r.paidCount} vendas`}
        />
        <Kpi
          label="Chargeback"
          value={pct(r.chargebackPct)}
          tone={r.chargebackPct > 1 ? "bad" : "muted"}
          hint={`${r.chargebackCount} no período`}
        />
        <Kpi
          label="Imposto"
          value={brl(r.taxCents)}
          hint={
            r.taxPercent > 0
              ? `${r.taxPercent}% do faturamento`
              : "defina a alíquota em Configurações"
          }
        />
      </div>

      {semGasto && (
        <p className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          Nenhum gasto lançado no período. Sem isso não dá para calcular ROAS, ROI nem lucro.
          Lance abaixo, por campanha e por dia.
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <section className="rounded-xl border border-white/5 bg-ink-800 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">Vendas por pagamento</h2>
          <PaymentDonut fatias={pag.fatias} total={pag.total} />
        </section>

        <section className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-ink-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Campanha</th>
                <th className="px-4 py-3 text-right">Vendas</th>
                <th className="px-4 py-3 text-right">Receita</th>
                <th className="px-4 py-3 text-right">Investido</th>
                <th className="px-4 py-3 text-right">Lucro</th>
                <th className="px-4 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    Nenhuma venda no período.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.campaign} className="bg-ink-800/40">
                    <td className="px-4 py-3 text-zinc-200">{c.campaign}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.paidCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                      {brl(c.revenueCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                      {brl(c.spendCents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        c.profitCents >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {brl(c.profitCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gold-400">
                      {c.roas ? c.roas.toFixed(2) : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      {creatives.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">
            Criativos que mais venderam (utm_content)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-ink-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Criativo</th>
                  <th className="px-4 py-3">Campanha</th>
                  <th className="px-4 py-3 text-right">Vendas</th>
                  <th className="px-4 py-3 text-right">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {creatives.map((c) => (
                  <tr key={`${c.campaign}|${c.content}`} className="bg-ink-800/40">
                    <td className="px-4 py-3 text-zinc-200">{c.content}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.campaign}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                      {brl(c.cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendForm campaigns={rows.map((c) => c.campaign)} />
        <WebhookInfo token={token} failedCount={failed} />
      </div>

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Últimas vendas</h2>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-ink-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Plataforma</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Campanha</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recent.map((s) => (
                  <tr key={s.id} className="bg-ink-800/40">
                    <td className="px-4 py-3 text-zinc-500">
                      {s.occurredAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{s.platform}</td>
                    <td className="px-4 py-3 text-zinc-200">{s.productName ?? ""}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.paymentMethod}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.utmCampaign ?? ""}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          s.status === "paid"
                            ? "text-emerald-400"
                            : s.status === "refunded" || s.status === "chargeback"
                            ? "text-red-400"
                            : "text-zinc-500"
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                      {brl(s.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-gold-500/50";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "muted";
}) {
  const cor =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-zinc-100";
  return (
    <div className="rounded-xl border border-white/5 bg-ink-800 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${cor}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-zinc-600">{hint}</div>}
    </div>
  );
}
