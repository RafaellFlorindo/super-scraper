"use client";

import { useEffect, useRef, useState } from "react";

interface UserInfo {
  name: string;
  email: string;
  role: string;
}

/** Menu do usuário no canto superior direito. */
export default function UserMenu({ user }: { user: UserInfo }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // fecha ao clicar fora ou apertar Esc, como qualquer menu do sistema
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-800 py-1 pl-1 pr-3 transition duration-200 ease-spring hover:border-white/20 active:scale-[0.97]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 text-xs font-semibold text-gold-300">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-32 truncate text-sm text-zinc-300">{user.name}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-3.5 w-3.5 text-zinc-500 transition duration-200 ease-spring ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/90 shadow-apple backdrop-blur-xl backdrop-saturate-150"
        >
          <div className="border-b border-white/5 px-4 py-3">
            <div className="truncate text-sm text-zinc-200">{user.name}</div>
            <div className="truncate text-xs text-zinc-500">{user.email}</div>
            <div className="mt-1 inline-block rounded-full bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-400">
              {user.role}
            </div>
          </div>

          <a
            href="/config"
            className="block px-4 py-2.5 text-sm text-zinc-300 transition duration-200 ease-spring hover:bg-white/5"
          >
            Configurações
          </a>

          <form action="/api/logout" method="post">
            <button className="w-full px-4 py-2.5 text-left text-sm text-zinc-400 transition duration-200 ease-spring hover:bg-white/5 hover:text-red-400">
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
