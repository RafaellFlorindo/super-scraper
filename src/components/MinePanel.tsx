"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { campoInset, card, pill, btnPrimary } from "@/lib/ui";

interface Run {
  id: string;
  query: string;
  status: string;
  found: number;
  novos: number;
  limit: number;
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

    // Sem isto o clique em cima do botão "desabilitado" simplesmente não fazia
    // nada — o navegador nem chama este handler pra um <button disabled>, então
    // parecia trava/bug em vez de avisar o motivo real.
    if (workerOnline === false) {
      setError("O worker não está rodando. Abra um terminal e rode npm run worker antes de minerar.");
      return;
    }

    const res = await fetch("/api/mine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, country, limit }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setRun({ id: data.runId, query, status: "running", found: 0, novos: 0, limit });
  }

  const busy = run?.status === "running";

  return (
    // glow-ring: esta é a caixa mais importante da tela — é daqui que sai
    // toda mineração — então é ela, e só ela, que carrega o contorno aceso.
    <div className={`mb-6 ${card} glow-ring p-5`}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium text-zinc-200">Minerar um nicho</h2>
        {workerOnline === false && (
          <span className={`${pill} bg-red-500/15 text-red-400`}>worker parado</span>
        )}
      </div>
      <p className="mb-4 text-xs leading-relaxed text-zinc-400">
        {workerOnline === false ? (
          <>
            A coleta roda no worker. Abra um terminal e rode <code className="text-zinc-300">npm run worker</code>.
          </>
        ) : (
          "Roda em segundo plano, sem abrir janela. O número é de anúncios INÉDITOS: o que já está no banco é pulado e a busca continua mais fundo."
        )}
      </p>

      <form onSubmit={start} className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ex: emagrecimento, trade esportivo, marcenaria..."
          disabled={busy}
          className={`min-w-64 flex-1 ${campoInset} placeholder:text-zinc-500 disabled:opacity-50`}
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={busy}
          className={`${campoInset} disabled:opacity-50`}
        >
          {["BR", "PT", "US", "ES", "MX"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          disabled={busy}
          className={`${campoInset} disabled:opacity-50`}
        >
          {[20, 40, 80, 150].map((n) => (
            <option key={n} value={n}>{n} novos</option>
          ))}
        </select>
        <button disabled={busy || !query.trim()} className={btnPrimary}>
          {busy ? "Minerando..." : "Minerar"}
        </button>
      </form>

      {busy && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs text-gold-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-400" />
            Coletando &quot;{run.query}&quot;: {run.found} vistos, {run.novos} novos
          </div>
          {/* Math.max garante uma lasca visível assim que começa, em vez da
              barra ficar em 0% (parecendo travada) até o primeiro anúncio
              inédito aparecer — a busca segue vendo repetidos até achar um. */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(4, (run.novos / run.limit) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {run?.status === "done" && (
        <div className="mt-3">
          {run.novos > 0 ? (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-emerald-400">
                {run.novos} anúncio(s) novo(s) de {run.found} vistos.
              </span>
              <a href={`/?run=${run.id}`} className={btnPrimary}>
                Ver esta coleta
              </a>
            </div>
          ) : (
            // sem isto, "40 coletados" e nenhum card novo na tela parece bug
            <span className="text-xs text-zinc-400">
              {run.found} anúncios vistos, nenhum inédito: todos já estavam no banco desta
              ou de outra busca. Tente outro termo ou outro país.
            </span>
          )}
        </div>
      )}
      {run?.status === "failed" && (
        <div className="mt-3 text-xs text-red-400">Falhou: {run.error}</div>
      )}
      {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
    </div>
  );
}
