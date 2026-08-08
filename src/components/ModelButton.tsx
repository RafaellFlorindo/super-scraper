"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnAccent } from "@/lib/ui";

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
      className={`${btnAccent} ${className}`}
    >
      {busy ? "Abrindo estúdio..." : "Modelar esta oferta"}
    </button>
  );
}
