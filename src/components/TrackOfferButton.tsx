"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Adiciona/remove uma oferta do acompanhamento da Análise de Ofertas. */
export default function TrackOfferButton({
  adId,
  trackedId,
}: {
  adId: string;
  trackedId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function alternar() {
    setBusy(true);
    if (trackedId) {
      await fetch("/api/tracked-offer", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: trackedId }),
      });
    } else {
      await fetch("/api/tracked-offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adId }),
      });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={alternar}
      disabled={busy}
      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition duration-200 ease-spring active:scale-[0.97] disabled:opacity-40 ${
        trackedId
          ? "border border-white/10 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
          : "border border-gold-500/40 text-gold-400 hover:bg-gold-500/10"
      }`}
    >
      {busy ? "..." : trackedId ? "Parar de acompanhar" : "Acompanhar oferta"}
    </button>
  );
}
