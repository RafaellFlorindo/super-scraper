"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "rascunho", tone: "bg-white/5 text-zinc-400" },
  ativo: { label: "ativo", tone: "bg-emerald-500/15 text-emerald-400" },
  concluido: { label: "concluído", tone: "bg-gold-500/15 text-gold-400" },
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
    <div className="flex flex-col rounded-xl border border-white/5 bg-ink-800 p-5 transition hover:border-gold-500/30">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[11px] uppercase tracking-wide ${badge.tone}`}
        >
          {badge.label}
        </span>
        <button
          onClick={() => setConfirming(true)}
          className="text-xs text-zinc-600 transition hover:text-red-400"
          title="Excluir projeto"
        >
          excluir
        </button>
      </div>

      <Link href={`/projetos/${id}`} className="font-medium text-zinc-100 hover:text-gold-400">
        {title}
      </Link>

      <div className="mt-2 text-xs text-zinc-500">
        {savedCount} referências · {conversationCount} conversas
        {creativeCount > 0 && ` · ${creativeCount} criativos`}
      </div>

      <div className="mt-4 flex gap-1">
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
  );
}
