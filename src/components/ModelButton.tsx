"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Leva o anúncio direto para o Estúdio de Agentes já configurado para modelá-lo.
 * É o pulo do banco de anúncios para a produção da nossa oferta.
 */
export default function ModelButton({
  adId,
  className = "",
}: {
  adId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function modelar() {
    setBusy(true);
    const res = await fetch("/api/model", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adId }),
    });
    const data = await res.json();
    if (data.projectId) router.push(`/projetos/${data.projectId}`);
    else setBusy(false);
  }

  return (
    <button
      onClick={modelar}
      disabled={busy}
      className={`rounded-lg bg-sun-400 px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-sun-300 disabled:opacity-50 ${className}`}
    >
      {busy ? "Abrindo estúdio..." : "Modelar esta oferta"}
    </button>
  );
}
