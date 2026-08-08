"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campoInset, btnPrimary } from "@/lib/ui";

export default function PasswordForm() {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErro(data.error ?? "Não foi possível trocar a senha.");
      setBusy(false);
      return;
    }
    // a troca derruba a sessão atual; sem login manual, volta pro início e
    // reconecta sozinho
    router.push("/");
  }

  return (
    <form onSubmit={trocar} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">Senha atual</span>
        <input
          type="password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
          className={`w-full ${campoInset}`}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">Nova senha</span>
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          minLength={8}
          required
          placeholder="mínimo de 8 caracteres"
          className={`w-full ${campoInset} placeholder:text-zinc-600`}
        />
      </label>
      {erro && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {erro}
        </p>
      )}
      <button disabled={busy} className={btnPrimary}>
        {busy ? "Trocando..." : "Trocar senha"}
      </button>
      <p className="text-[11px] text-zinc-600">Isso encerra sua sessão atual — você é reconectado automaticamente.</p>
    </form>
  );
}
