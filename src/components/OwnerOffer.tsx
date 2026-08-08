"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, campoInset, btnPrimary, linkGhost } from "@/lib/ui";

/**
 * Descrição da nossa oferta. Sem isso os agentes escrevem no vácuo: eles sabem
 * tudo sobre o concorrente e nada sobre o que o usuário vende.
 */
export default function OwnerOffer({
  projectId,
  initial,
}: {
  projectId: string;
  initial: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(!initial);

  async function save() {
    setSaving(true);
    await fetch("/api/creatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "offer", projectId, ownerOffer: text }),
    });
    setSaving(false);
    setSaved(true);
    setOpen(false);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  if (!open) {
    return (
      <div className={`${card} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">A nossa oferta</div>
            <p className="mt-1 truncate text-sm text-zinc-300">
              {text || "não descrita"}
            </p>
          </div>
          <button onClick={() => setOpen(true)} className={`shrink-0 ${linkGhost}`}>
            editar
          </button>
        </div>
        {saved && <p className="mt-2 text-xs text-emerald-400">Salvo.</p>}
      </div>
    );
  }

  return (
    <div className={`${card} border-gold-500/20 p-4`}>
      <div className="mb-1 text-sm font-medium text-zinc-300">A nossa oferta</div>
      <p className="mb-3 text-xs text-zinc-500">
        O que você vende, para quem e por quanto. Os três agentes e a fábrica de criativos
        usam isto em toda resposta.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Ex: curso online de bolos caseiros sem glúten, R$97, para mulheres de 30 a 50 anos que querem renda extra em casa. Diferencial: método de um bowl só, sem batedeira."
        className={`w-full resize-none !h-auto py-2 ${campoInset} placeholder:text-zinc-600`}
      />
      <button onClick={save} disabled={saving} className={`mt-2 ${btnPrimary} !h-auto px-4 py-1.5`}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
