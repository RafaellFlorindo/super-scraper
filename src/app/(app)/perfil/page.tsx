import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { computeAchievements } from "@/lib/achievements";
import MedalIcon from "@/components/MedalIcon";
import PasswordForm from "@/components/PasswordForm";
import ProfileForm from "@/components/ProfileForm";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Perfil() {
  const sessionUser = await currentUser();
  if (!sessionUser) redirect("/api/auto-login");

  const [user, achievements, vendas] = await Promise.all([
    db.user.findUnique({ where: { id: sessionUser.id } }),
    computeAchievements(),
    db.sale.count({ where: { status: "paid" } }),
  ]);
  if (!user) redirect("/api/auto-login");

  const membro = user.createdAt.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-8">
      <h1 className="mb-1 text-[28px] font-semibold tracking-tight text-zinc-100">Meu Perfil</h1>
      <p className="mb-6 text-[13px] text-zinc-500">Sua conta e o seu caminho de vitórias.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <div className={`${card} p-5`}>
            <h2 className="mb-4 text-sm font-medium text-zinc-300">Dados da conta</h2>
            <ProfileForm
              name={user.name}
              email={user.email}
              cnpj={user.cnpj ?? ""}
              phone={user.phone ?? ""}
              avatarUrl={user.avatarPath ? `/api/media/${user.avatarPath}` : null}
            />
          </div>

          <div className={`${card} p-5`}>
            <h2 className="mb-3 text-sm font-medium text-zinc-300">Trocar senha</h2>
            <PasswordForm />
          </div>
        </div>

        {/* flex-col + flex-1 no card: a coluna estica até a altura da esquerda,
            sem sobrar aquele vão morto embaixo do caminho de vitórias */}
        <div className="flex flex-col gap-6">
          {/* resumo rápido no topo, estilo Kiwify */}
          <div className="grid grid-cols-3 gap-3">
            <Resumo label="Faturamento vitalício" valor={brl(achievements.totalCents)} destaque />
            <Resumo label="Vendas pagas" valor={String(vendas)} />
            <Resumo label="Membro desde" valor={membro} />
          </div>

          <div className={`flex flex-1 flex-col ${card} p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <h2 className="text-sm font-medium text-zinc-100">Caminho de vitórias</h2>
              </div>
              {achievements.next && (
                <span className="text-xs text-zinc-500">
                  próximo: <span className="text-gold-400">{achievements.next.label}</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              {achievements.milestones.map((m) => {
                const ehProximo = achievements.next?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition duration-200 ease-spring ${
                      m.achievedAt
                        ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                        : ehProximo
                        ? "border-gold-500/25 bg-gold-500/[0.04]"
                        : "border-white/5"
                    }`}
                  >
                    <MedalIcon tier={m.tier} achieved={Boolean(m.achievedAt)} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm text-zinc-100">
                        {m.label}
                        {m.achievedAt && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-emerald-400" aria-hidden>
                            <path d="m5 13 4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {m.achievedAt ? (
                        <div className="text-xs text-emerald-400/80">
                          Conquistado em {m.achievedAt.toLocaleDateString("pt-BR")}
                        </div>
                      ) : ehProximo ? (
                        <div className="mt-1.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300"
                              style={{ width: `${achievements.progressPct}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            {achievements.progressPct.toFixed(1)}% —{" "}
                            {brl(Math.max(0, m.amountCents - achievements.totalCents))} para chegar
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-600">
                          {brl(Math.max(0, m.amountCents - achievements.totalCents))} para chegar
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-auto pt-4 text-[11px] text-zinc-600">
              Calculado a partir das vendas pagas no Traqueamento, menos reembolso e chargeback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Resumo({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destaque
          ? "border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-ink-800"
          : "border-white/5 bg-ink-800"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 truncate text-lg font-semibold ${destaque ? "text-gold-300" : "text-zinc-100"}`}>
        {valor}
      </div>
    </div>
  );
}
