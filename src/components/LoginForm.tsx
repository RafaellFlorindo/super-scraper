"use client";

import { useActionState } from "react";

interface Estado {
  erro?: string;
}

export default function LoginForm({
  action,
  proximo,
  modo = "login",
}: {
  action: (prev: unknown, data: FormData) => Promise<Estado | void>;
  proximo?: string;
  modo?: "login" | "instalar";
}) {
  const [estado, formAction, pendente] = useActionState(action, {} as Estado);
  const instalando = modo === "instalar";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* mesmo degradê da barra lateral, para a entrada não parecer outro app */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#16306b] via-[#0d1c42] to-[#070a18]" />
      <div className="absolute -left-20 top-16 h-96 w-96 rounded-full bg-[#2b5bd4]/25 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-gold-500/15 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(circle, #93b4ff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900/80 p-8 backdrop-blur">
        <div className="mb-6 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-7 w-7 text-gold-400" aria-hidden>
            <path d="M18.5 3 8 18h6.5L13.5 29 24 14h-6.5z" fill="currentColor" />
          </svg>
          <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-xl font-semibold text-transparent">
            Super Scraper
          </span>
        </div>

        <h1 className="mb-1 text-lg font-medium text-zinc-100">
          {instalando ? "Criar conta de administrador" : "Entrar"}
        </h1>
        <p className="mb-6 text-xs text-zinc-500">
          {instalando
            ? "Primeira execução: esta conta terá acesso total, inclusive às chaves de API."
            : "Acesso restrito."}
        </p>

        <form action={formAction} className="space-y-3">
          {proximo && <input type="hidden" name="proximo" value={proximo} />}

          {instalando && (
            <Campo
              label="Nome"
              name="nome"
              type="text"
              autoComplete="name"
              placeholder="Seu nome"
              required
            />
          )}

          <Campo
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />

          <Campo
            label="Senha"
            name="senha"
            type="password"
            autoComplete={instalando ? "new-password" : "current-password"}
            placeholder={instalando ? "mínimo de 8 caracteres" : "sua senha"}
            required
            minLength={instalando ? 8 : undefined}
          />

          {estado?.erro && (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {estado.erro}
            </p>
          )}

          <button
            disabled={pendente}
            className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:opacity-50"
          >
            {pendente ? "Aguarde..." : instalando ? "Criar e entrar" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Campo({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
      />
    </label>
  );
}
