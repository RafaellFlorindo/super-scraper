"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Reanalisa os funis mais quentes agora, sem esperar o worker chegar neles sozinho. */
export default function RefreshFunnelsButton({ minScore }: { minScore: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function atualizar() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/funnel/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minScore: minScore || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(
      data.criados > 0
        ? `${data.criados} funil(is) na fila com prioridade.`
        : "Já estavam todos na fila ou nada para atualizar."
    );
    setTimeout(() => router.refresh(), 3000);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={atualizar}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden>
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
        </svg>
        {busy ? "Enfileirando..." : "Atualizar agora"}
      </button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}
