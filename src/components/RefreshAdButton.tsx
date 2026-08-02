"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-coleta o anúncio AGORA na Ad Library e recarrega a página quando o
 * snapshot novo chega — é o que atualiza a tendência para "neste momento".
 */
export default function RefreshAdButton({ adId }: { adId: string }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;
    timer.current = setInterval(async () => {
      const data = await fetch(`/api/ad/refresh?jobId=${jobId}`).then((r) => r.json());
      if (data.status === "done") {
        clearInterval(timer.current!);
        setJobId(null);
        router.refresh();
      } else if (data.status === "failed") {
        clearInterval(timer.current!);
        setJobId(null);
        setErro(data.error ?? "falhou");
      }
    }, 3000);
    return () => clearInterval(timer.current!);
  }, [jobId, router]);

  async function atualizar() {
    setErro(null);
    const res = await fetch("/api/ad/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adId }),
    });
    const data = await res.json();
    if (data.error) return setErro(data.error);
    setJobId(data.jobId);
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={atualizar}
        disabled={Boolean(jobId)}
        title="Re-coleta este anúncio agora na Ad Library e atualiza a tendência"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:border-gold-500/40 hover:text-gold-400 disabled:opacity-60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-3.5 w-3.5 ${jobId ? "animate-spin" : ""}`}
          aria-hidden
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
        </svg>
        {jobId ? "Coletando..." : "Atualizar agora"}
      </button>
      {erro && <span className="text-xs text-red-400">{erro}</span>}
    </span>
  );
}
