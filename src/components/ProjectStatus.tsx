"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "rascunho", tone: "bg-white/5 text-zinc-400" },
  ativo: { label: "ativo", tone: "bg-emerald-500/15 text-emerald-400" },
  concluido: { label: "concluído", tone: "bg-gold-500/15 text-gold-400" },
};

/** Troca o status sem sair do projeto. */
export default function ProjectStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mudar(novo: string) {
    setBusy(true);
    await fetch("/api/projects", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: novo }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      {Object.entries(LABELS).map(([value, meta]) => (
        <button
          key={value}
          onClick={() => mudar(value)}
          disabled={busy || value === status}
          className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide transition duration-200 ease-spring ${
            value === status
              ? `${meta.tone} cursor-default`
              : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
          }`}
        >
          {meta.label}
        </button>
      ))}
    </div>
  );
}
