"use client";

import { useActionState } from "react";
import { campo, btnPrimary } from "@/lib/ui";

interface Estado {
  erro?: string;
}

type Action = (prev: unknown, data: FormData) => Promise<Estado | void>;

/** Formulário de instalação: cria a única conta de admin do app. */
export default function LoginForm({ action }: { action: Action }) {
  const [estado, formAction, pendente] = useActionState(action, {} as Estado);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* mesmo degradê da barra lateral, para a entrada não parecer outro app */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#191645] via-[#100f2b] to-[#07070f]" />
      <div className="absolute -left-20 top-16 h-96 w-96 rounded-full bg-[#4f46e5]/25 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sun-500/15 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(circle, #a5a0ff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900/80 p-8 backdrop-blur">
        <div className="mb-6 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
            <defs>
              <linearGradient id="login-logo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8f88ff" />
                <stop offset="1" stopColor="#5b4fe0" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#login-logo)" />
            <path
              d="M6.5 21.5l5.5-6.5 4.3 3.8 5.7-8"
              fill="none"
              stroke="#fff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="25.5" cy="13" r="1.8" fill="#fff" />
          </svg>
          <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-xl font-semibold text-transparent">
            Super Scraper
          </span>
        </div>

        <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-100">Criar conta de administrador</h1>
        <p className="mb-6 text-xs text-zinc-500">
          Primeira execução: esta conta terá acesso total, inclusive às chaves de API.
        </p>

        <form action={formAction} className="space-y-3">
          <Campo label="Nome" name="nome" type="text" autoComplete="name" placeholder="Seu nome" required />

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
            autoComplete="new-password"
            placeholder="mínimo de 8 caracteres"
            required
            minLength={8}
          />

          {estado?.erro && (
            <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {estado.erro}
            </p>
          )}

          <button disabled={pendente} className={`w-full ${btnPrimary}`}>
            {pendente ? "Aguarde..." : "Criar e entrar"}
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
      <input {...props} className={`w-full ${campo} placeholder:text-zinc-600`} />
    </label>
  );
}
