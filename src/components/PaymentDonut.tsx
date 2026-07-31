"use client";

import { useState } from "react";

interface Fatia {
  method: string;
  label: string;
  color: string;
  count: number;
  cents: number;
  share: number;
}

const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Rosca de vendas por forma de pagamento.
 *
 * SVG puro, sem biblioteca: são no máximo quatro fatias e o cálculo de arco é
 * trivial, então uma dependência de gráfico aqui só somaria peso.
 *
 * Entre as fatias existe um vão de 2px na cor da superfície, que é o que separa
 * visualmente cores vizinhas sem depender de contorno.
 */
export default function PaymentDonut({
  fatias,
  total,
}: {
  fatias: Fatia[];
  total: number;
}) {
  const [hover, setHover] = useState<string | null>(null);

  if (!total) {
    return (
      <div className="flex h-full min-h-56 items-center justify-center text-sm text-zinc-600">
        Nenhuma venda paga no período.
      </div>
    );
  }

  const R = 70;
  const STROKE = 26;
  const circ = 2 * Math.PI * R;
  const GAP = 2; // vão em px de arco entre fatias

  let offset = 0;
  const arcos = fatias.map((f) => {
    const len = (f.share / 100) * circ;
    const visivel = Math.max(len - GAP, 1);
    const arco = { ...f, len: visivel, offset };
    offset += len;
    return arco;
  });

  const ativo = fatias.find((f) => f.method === hover);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative">
        <svg width={180} height={180} viewBox="0 0 180 180" role="img" aria-label="Vendas por forma de pagamento">
          <g transform="rotate(-90 90 90)">
            {arcos.map((a) => (
              <circle
                key={a.method}
                cx={90}
                cy={90}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={hover === a.method ? STROKE + 5 : STROKE}
                strokeDasharray={`${a.len} ${circ - a.len}`}
                strokeDashoffset={-a.offset}
                onMouseEnter={() => setHover(a.method)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-[stroke-width]"
              />
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {ativo ? (
            <>
              <div className="text-[11px] text-zinc-500">{ativo.label}</div>
              <div className="text-xl font-semibold text-zinc-100">{ativo.count}</div>
              <div className="text-[11px] text-zinc-500">{brl(ativo.cents)}</div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-zinc-500">Total</div>
              <div className="text-2xl font-semibold text-zinc-100">{total}</div>
            </>
          )}
        </div>
      </div>

      {/* legenda sempre presente: identidade nunca fica só na cor */}
      <ul className="space-y-2 text-sm">
        {fatias.map((f) => (
          <li
            key={f.method}
            onMouseEnter={() => setHover(f.method)}
            onMouseLeave={() => setHover(null)}
            className="flex cursor-pointer items-center gap-2"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: f.color }}
            />
            <span className="text-zinc-300">{f.label}</span>
            <span className="tabular-nums text-zinc-500">{f.share.toFixed(0)}%</span>
            <span className="tabular-nums text-zinc-600">{f.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
