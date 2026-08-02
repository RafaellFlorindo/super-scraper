"use client";

import { useState } from "react";

interface Dia {
  date: string;
  label: string;
  revenueCents: number;
  spendCents: number;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gráfico de barras receita x gasto, dia a dia — a referência aqui é o
 * dashboard da UTMify: barras simples, tooltip ao passar o mouse, sem libs. */
export default function RevenueChart({ dias }: { dias: Dia[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...dias.map((d) => Math.max(d.revenueCents, d.spendCents)));
  const ativo = hover !== null ? dias[hover] : null;
  const poucos = dias.length <= 14;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold-500" /> Receita
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-600" /> Gasto
          </span>
        </div>
        {ativo && (
          <div className="text-xs text-zinc-400">
            <span className="text-zinc-500">{ativo.label}:</span>{" "}
            <span className="text-gold-400">{brl(ativo.revenueCents)}</span>
            {" · "}
            <span className="text-zinc-500">{brl(ativo.spendCents)}</span>
          </div>
        )}
      </div>

      <div className="flex h-40 items-end gap-[3px]">
        {dias.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 flex-col items-center justify-end gap-[2px]"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={`w-full rounded-sm transition-colors ${
                hover === i ? "bg-gold-400" : "bg-gold-500/70"
              }`}
              style={{ height: `${Math.max(2, (d.revenueCents / max) * 100)}%` }}
            />
            <div
              className={`w-full rounded-sm transition-colors ${
                hover === i ? "bg-zinc-500" : "bg-zinc-700"
              }`}
              style={{ height: `${Math.max(d.spendCents > 0 ? 2 : 0, (d.spendCents / max) * 60)}%` }}
            />
            {poucos && (
              <span className="mt-1 text-[10px] text-zinc-600">{d.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
