"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    // a troca derruba a sessão atual, então volta para o login
    router.push("/login");
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
          className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-gold-500/50"
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
          className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
        />
      </label>
      {erro && (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {erro}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:opacity-50"
      >
        {busy ? "Trocando..." : "Trocar senha"}
      </button>
      <p className="text-[11px] text-zinc-600">Isso encerra sua sessão atual — você precisa entrar de novo.</p>
    </form>
  );
}
