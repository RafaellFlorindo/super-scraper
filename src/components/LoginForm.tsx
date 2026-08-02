"use client";

import { useActionState, useState } from "react";

interface Estado {
  erro?: string;
}

type Action = (prev: unknown, data: FormData) => Promise<Estado | void>;

export default function LoginForm({
  action,
  registerAction,
  proximo,
  modo = "login",
  erroInicial,
}: {
  action: Action;
  /** Cadastro público — só existe no modo login, não na instalação. */
  registerAction?: Action;
  proximo?: string;
  modo?: "login" | "instalar";
  /** Erro vindo por query string (ex.: retorno de OAuth que falhou). */
  erroInicial?: string;
}) {
  const [aba, setAba] = useState<"entrar" | "criar">("entrar");
  const [estado, formAction, pendente] = useActionState(action, {} as Estado);
  const [estadoCriar, criarAction, pendenteCriar] = useActionState(
    registerAction ?? action,
    {} as Estado
  );

  const instalando = modo === "instalar";
  const criando = !instalando && aba === "criar";
  const erro = (criando ? estadoCriar?.erro : estado?.erro) ?? erroInicial;

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

        {instalando ? (
          <>
            <h1 className="mb-1 text-lg font-medium text-zinc-100">
              Criar conta de administrador
            </h1>
            <p className="mb-6 text-xs text-zinc-500">
              Primeira execução: esta conta terá acesso total, inclusive às chaves de API.
            </p>
          </>
        ) : (
          <div className="mb-6 flex rounded-lg bg-white/5 p-1">
            {(
              [
                ["entrar", "Entrar"],
                ["criar", "Criar conta"],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                  aba === id ? "bg-gold-500 font-medium text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        <form action={criando ? criarAction : formAction} className="space-y-3">
          {proximo && <input type="hidden" name="proximo" value={proximo} />}

          {(instalando || criando) && (
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
            autoComplete={instalando || criando ? "new-password" : "current-password"}
            placeholder={instalando || criando ? "mínimo de 8 caracteres" : "sua senha"}
            required
            minLength={instalando || criando ? 8 : undefined}
          />

          {erro && (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {erro}
            </p>
          )}

          <button
            disabled={pendente || pendenteCriar}
            className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gold-400 disabled:opacity-50"
          >
            {pendente || pendenteCriar
              ? "Aguarde..."
              : instalando
              ? "Criar e entrar"
              : criando
              ? "Criar conta"
              : "Entrar"}
          </button>
        </form>

        {!instalando && (
          <>
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              ou continue com
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                  <path fill="#EA4335" d="M12 5.3c1.7 0 3.2.6 4.4 1.7l3.2-3.2C17.6 1.9 15 .8 12 .8 7.7.8 3.9 3.2 2 6.9l3.8 3C6.7 7.1 9.1 5.3 12 5.3Z" />
                  <path fill="#4285F4" d="M23.2 12.3c0-.9-.1-1.6-.2-2.3H12v4.4h6.3c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.6-5 3.6-8.6Z" />
                  <path fill="#FBBC05" d="M5.8 14.1a6.9 6.9 0 0 1 0-4.2L2 6.9a11.2 11.2 0 0 0 0 10.2l3.8-3Z" />
                  <path fill="#34A853" d="M12 23.2c3 0 5.6-1 7.5-2.7l-3.7-2.9c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.3-1.8-6.2-4.6l-3.8 3c1.9 3.7 5.7 6.1 10 6.1Z" />
                </svg>
                Google
              </a>
              <a
                href="/api/auth/twitter"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                  <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1.2 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L7 3.7H5.1L17.8 20Z" />
                </svg>
                X
              </a>
            </div>
          </>
        )}
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
