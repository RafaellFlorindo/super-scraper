"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  adId: string;
  projects: { id: string; title: string }[];
  saved: string[];
}

export default function SaveToProject({ adId, projects, saved }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[]>(saved);

  async function attach(projectId: string) {
    setBusy(true);
    await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adId, projectId }),
    });
    setDone((d) => [...d, projectId]);
    setBusy(false);
    router.refresh();
  }

  if (projects.length === 0) {
    return (
      <p className="text-xs text-zinc-600">
        Crie um projeto para usar este anúncio como referência dos agentes.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {projects.map((p) => {
        const attached = done.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => !attached && attach(p.id)}
            disabled={busy || attached}
            className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition duration-200 ease-spring active:scale-[0.98] ${
              attached
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-ink-900 text-zinc-300 hover:border-gold-500/40 hover:text-gold-400"
            }`}
          >
            {attached ? `✓ ${p.title}` : p.title}
          </button>
        );
      })}
    </div>
  );
}
