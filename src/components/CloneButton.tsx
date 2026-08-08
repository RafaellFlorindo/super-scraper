"use client";

import { useState } from "react";
import { btnSecondary } from "@/lib/ui";

/** Clona a página de destino de um anúncio direto da tela dele. */
export default function CloneButton({ url, adId }: { url: string; adId: string }) {
  const [estado, setEstado] = useState<"idle" | "busy" | "ok" | "erro">("idle");
  const [slug, setSlug] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function clonar() {
    setEstado("busy");
    const res = await fetch("/api/clone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, adId }),
    });
    const data = await res.json();
    if (data.error) {
      setErro(data.error);
      setEstado("erro");
    } else {
      setSlug(data.slug);
      setEstado("ok");
    }
  }

  if (estado === "ok") {
    return (
      <p className="text-xs text-emerald-400">
        Na fila. Acompanhe em{" "}
        <a href="/clones" className="underline underline-offset-2">
          Páginas Clonadas
        </a>{" "}
        (/p/{slug}).
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={clonar}
        disabled={estado === "busy"}
        className={`w-full !h-auto px-3 py-2 text-xs ${btnSecondary} hover:border-gold-500/40 hover:text-gold-400 disabled:opacity-40`}
      >
        {estado === "busy" ? "Enfileirando..." : "Clonar página de destino"}
      </button>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
