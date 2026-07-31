"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Lançamento manual de gasto. Sem isto o dashboard só mostra receita, nunca ROI. */
export default function SpendForm({ campaigns }: { campaigns: string[] }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(campaigns[0] ?? "");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/spend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ utmCampaign: campaign, day, amount }),
    });
    if (res.ok) {
      setMsg("Gasto lançado.");
      setAmount("");
      router.refresh();
    } else {
      setMsg((await res.json()).error ?? "Falhou");
    }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
      <h2 className="mb-1 text-sm font-medium text-zinc-300">Lançar gasto de anúncio</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Por campanha e por dia. Lançar de novo o mesmo par substitui o valor anterior.
      </p>

      <form onSubmit={save} className="space-y-2">
        <input
          list="campanhas"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="utm_campaign, igual ao do link do anúncio"
          className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
        />
        <datalist id="campanhas">
          {campaigns.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="flex gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="R$ investido, ex: 250,00"
            className="flex-1 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
          />
          <button
            disabled={!campaign || !amount}
            className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-medium text-ink-900 hover:bg-gold-400 disabled:opacity-40"
          >
            Lançar
          </button>
        </div>
      </form>

      {msg && <p className="mt-2 text-xs text-emerald-400">{msg}</p>}
    </div>
  );
}
