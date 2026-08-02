"use client";

import { useEffect, useState } from "react";

const PLATFORMS = [
  { id: "kiwify", label: "Kiwify" },
  { id: "cakto", label: "Cakto" },
  { id: "hotmart", label: "Hotmart" },
  { id: "kirvano", label: "Kirvano" },
];

export default function WebhookInfo({
  token,
  failedCount,
}: {
  token: string;
  failedCount: number;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // window só existe no cliente; em produção isto vira o domínio da Vercel
  useEffect(() => setOrigin(window.location.origin), []);

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h2 className="mb-1 text-sm font-medium text-amber-400">Webhook não configurado</h2>
        <p className="text-xs text-zinc-400">
          Vá em <strong className="text-zinc-200">Configurações</strong> e gere um token de
          webhook. Sem ele o endpoint recusa tudo, e precisa recusar, porque é público.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-ink-800 p-5">
      <h2 className="mb-1 text-sm font-medium text-zinc-300">URLs de webhook</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Cole na configuração de webhook da plataforma. Marque os eventos de compra aprovada,
        reembolso e chargeback.
      </p>

      <div className="space-y-2">
        {PLATFORMS.map((p) => {
          const url = `${origin}/api/webhook/${p.id}?token=${token}`;
          return (
            <div key={p.id}>
              <div className="mb-1 text-xs text-zinc-400">{p.label}</div>
              <div className="flex gap-2">
                <code className="flex-1 truncate rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs text-zinc-400">
                  {url}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    setCopied(p.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-gold-500/40 hover:text-gold-400"
                >
                  {copied === p.id ? "copiado" : "copiar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {origin.includes("localhost") && (
        <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          Estas URLs são de localhost, então a plataforma não alcança seu PC pela internet.
          Elas passam a valer quando o app estiver hospedado.
        </p>
      )}

      {failedCount > 0 && (
        <p className="mt-3 text-xs text-red-400">
          {failedCount} webhook(s) chegaram mas falharam ao processar. Veja com{" "}
          <code>npm run webhooks</code>.
        </p>
      )}
    </div>
  );
}
