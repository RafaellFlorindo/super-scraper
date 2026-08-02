"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, { label: string; tone: string; barra: string }> = {
  rascunho: { label: "rascunho", tone: "bg-white/5 text-zinc-400", barra: "bg-zinc-600" },
  ativo: { label: "ativo", tone: "bg-emerald-500/15 text-emerald-400", barra: "bg-emerald-500" },
  concluido: { label: "concluído", tone: "bg-gold-500/15 text-gold-400", barra: "bg-gold-500" },
};

interface Props {
  id: string;
  title: string;
  status: string;
  savedCount: number;
  conversationCount: number;
  creativeCount: number;
}

export default function ProjectCard({
  id,
  title,
  status,
  savedCount,
  conversationCount,
  creativeCount,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const badge = LABELS[status] ?? LABELS.rascunho;

  async function mudarStatus(novo: string) {
    setBusy(true);
    await fetch("/api/projects", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: novo }),
    });
    setBusy(false);
    router.refresh();
  }

  async function excluir() {
    setBusy(true);
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <div className="mb-1 font-medium text-zinc-100">Excluir &quot;{title}&quot;?</div>
        <p className="mb-4 text-xs text-zinc-400">
          Apaga as {conversationCount} conversa(s) e {creativeCount} criativo(s) gerado(s)
          deste projeto. Os anúncios minerados continuam no banco.
        </p>
        <div className="flex gap-2">
          <button
            onClick={excluir}
            disabled={busy}
            className="rounded-lg bg-red-500/90 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? "Excluindo..." : "Sim, excluir"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-zinc-300 hover:border-white/25"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-ink-700 to-ink-800 transition hover:border-gold-500/40 hover:shadow-[0_0_0_1px_rgba(232,194,100,0.15),0_8px_24px_-8px_rgba(0,0,0,0.5)]">
      {/* barra de status: identidade visual imediata, sem precisar ler o texto */}
      <div className={`h-1 w-full ${badge.barra}`} />

      <div className="flex flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${badge.tone}`}>
            {badge.label}
          </span>
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-zinc-600 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
            title="Excluir projeto"
          >
            excluir
          </button>
        </div>

        <Link
          href={`/projetos/${id}`}
          className="text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-gold-300"
        >
          {title}
        </Link>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
              <rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            {savedCount} ref.
          </span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {conversationCount} conversas
          </span>
          {creativeCount > 0 && (
            <span className="flex items-center gap-1 text-gold-400/80">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
                <path d="M12 2 15 9l7 1-5 5 1.5 7L12 18.5 5.5 22 7 15 2 10l7-1Z" />
              </svg>
              {creativeCount} criativos
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-1 border-t border-white/5 pt-3">
          {Object.entries(LABELS).map(([value, meta]) => (
            <button
              key={value}
              onClick={() => mudarStatus(value)}
              disabled={busy || value === status}
              className={`rounded px-2 py-1 text-[11px] transition ${
                value === status
                  ? `${meta.tone} cursor-default`
                  : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
