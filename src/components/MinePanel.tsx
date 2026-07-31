"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Run {
  id: string;
  query: string;
  status: string;
  found: number;
  error?: string | null;
}

export default function MinePanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("BR");
  const [limit, setLimit] = useState(40);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null);

  // Quem executa a coleta é o worker. Se ele estiver parado, o job fica na fila
  // sem nada acontecer — então vale avisar antes de a pessoa clicar.
  useEffect(() => {
    const check = async () => {
      const data = await fetch("/api/mine").then((r) => r.json());
      setWorkerOnline(data.workerOnline);
      if (data.run?.status === "running" || run?.status === "running") {
        setRun(data.run);
        if (data.run?.status !== "running") router.refresh();
      }
    };
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, [run?.status, router]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, country, limit }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setRun({ id: data.runId, query, status: "running", found: 0 });
  }

  const busy = run?.status === "running";

  return (
    <div className="mb-6 rounded-xl border border-white/5 bg-ink-800 p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium text-zinc-300">Minerar um nicho</h2>
        {workerOnline === false && (
          <span className="rounded bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">
            worker parado
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        {workerOnline === false ? (
          <>
            A coleta roda no worker. Abra um terminal e rode <code className="text-zinc-300">npm run worker</code>.
          </>
        ) : (
          "Roda em segundo plano, sem abrir janela. Leva alguns minutos."
        )}
      </p>

      <form onSubmit={start} className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ex: emagrecimento, trade esportivo, marcenaria..."
          disabled={busy}
          className="min-w-64 flex-1 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50 disabled:opacity-50"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={busy}
          className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm disabled:opacity-50"
        >
          {["BR", "PT", "US", "ES", "MX"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          disabled={busy}
          className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm disabled:opacity-50"
        >
          {[20, 40, 80, 150].map((n) => (
            <option key={n} value={n}>{n} anúncios</option>
          ))}
        </select>
        <button
          disabled={busy || !query.trim() || workerOnline === false}
          className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Minerando..." : "Minerar"}
        </button>
      </form>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gold-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-400" />
          Coletando &quot;{run.query}&quot;: {run.found} anúncios até agora
        </div>
      )}
      {run?.status === "done" && (
        <div className="mt-3 text-xs text-emerald-400">
          Coleta concluída: {run.found} anúncios. Rode <code>npm run worker</code> para enriquecer.
        </div>
      )}
      {run?.status === "failed" && (
        <div className="mt-3 text-xs text-red-400">Falhou: {run.error}</div>
      )}
      {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
    </div>
  );
}
