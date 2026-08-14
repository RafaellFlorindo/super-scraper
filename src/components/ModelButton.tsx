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
    // Discreto em repouso, dourado só no hover do card: numa grade de 60
    // anúncios, 60 botões dourados sólidos gritavam todos juntos e nada
    // sobrava de destaque. O acento fica pro card sob o cursor.
    <button
      onClick={modelar}
      disabled={busy}
      className={`h-9 rounded-xl border border-white/10 bg-white/[0.05] text-[13px] font-medium text-zinc-300 transition duration-200 ease-spring group-hover:border-sun-400/50 group-hover:bg-sun-400/10 group-hover:text-sun-200 hover:!bg-sun-400 hover:!text-ink-900 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {busy ? "Abrindo estúdio..." : "Modelar esta oferta"}
    </button>
  );
}
