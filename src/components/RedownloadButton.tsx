"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/lib/ui";

/**
 * Aparece no lugar de um criativo que falhou ao baixar. As URLs de mídia da
 * Meta são assinadas e expiram, então clicar aqui pede uma URL nova à Ad
 * Library e tenta de novo — sem isso o criativo ficava quebrado pra sempre.
 */
export default function RedownloadButton({
  adId,
  error,
  attempts,
}: {
  adId: string;
  error: string | null;
  attempts: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [enfileirado, setEnfileirado] = useState(false);

  async function tentar() {
    setBusy(true);
    await fetch("/api/creative/redownload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adId }),
    });
    setBusy(false);
    setEnfileirado(true);
    setTimeout(() => router.refresh(), 4000);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <span className="text-xs text-zinc-500">
        {error ? "Falhou ao baixar" : "não baixado ainda"}
      </span>
      {error && (
        <span className="max-w-[220px] truncate text-[11px] text-red-400" title={error}>
          {error}
        </span>
      )}
      {attempts > 0 && (
        <span className="text-[11px] text-zinc-600">{attempts} tentativa(s)</span>
      )}
      {error && (
        <button
          onClick={tentar}
          disabled={busy || enfileirado}
          className={`mt-1 !h-auto px-3 py-1.5 text-xs ${btnSecondary} hover:border-gold-500/40 hover:text-gold-400 disabled:opacity-50`}
        >
          {enfileirado ? "Na fila, aguarde..." : busy ? "Enfileirando..." : "Tentar de novo"}
        </button>
      )}
    </div>
  );
}
