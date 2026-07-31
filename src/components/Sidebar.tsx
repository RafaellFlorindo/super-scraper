"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Ícones em traço, no mesmo peso do raio da marca. */
const ICONS: Record<string, React.ReactNode> = {
  banco: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  // estrelas: o estúdio é a parte "mágica", e distingue bem da engrenagem
  agentes: (
    <>
      <path d="M11 3.5 12.6 8l4.5 1.6-4.5 1.6L11 15.7 9.4 11.2 4.9 9.6 9.4 8 11 3.5Z" />
      <path d="M18 14.5 18.8 17l2.5.9-2.5.9-.8 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" />
    </>
  ),
  traqueamento: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  funis: (
    <>
      <path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z" />
    </>
  ),
  config: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
};

const NAV = [
  { href: "/", icon: "banco", label: "Banco de Anúncios", hint: "minerar e filtrar" },
  { href: "/projetos", icon: "agentes", label: "Estúdio de Agentes", hint: "modelar e criar" },
  { href: "/traqueamento", icon: "traqueamento", label: "Traqueamento", hint: "vendas e ROI" },
  { href: "/funis", icon: "funis", label: "Funis", hint: "destinos mapeados" },
  { href: "/config", icon: "config", label: "Configurações", hint: "chaves e coleta" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative w-64 shrink-0 overflow-hidden border-r border-white/5">
      {/* degradê azul-marinho com brilho dourado, no espírito do cartão de plano */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#16306b] via-[#0d1c42] to-[#070a18]" />
      <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#2b5bd4]/25 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-60 w-60 rounded-full bg-gold-500/15 blur-3xl" />
      {/* textura de pontos, como no cartão do plano */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(circle, #93b4ff 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold-500/25 to-transparent" />

      <div className="relative flex h-full flex-col p-4">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          <svg viewBox="0 0 32 32" className="h-6 w-6 text-gold-400" aria-hidden>
            <path d="M18.5 3 8 18h6.5L13.5 29 24 14h-6.5z" fill="currentColor" />
          </svg>
          <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-lg font-semibold text-transparent">
            Scrapper
          </span>
        </div>

        <nav className="space-y-1.5">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                  active
                    ? "bg-gradient-to-r from-gold-500/20 to-transparent ring-1 ring-gold-500/30"
                    : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                    active
                      ? "bg-gold-500 text-ink-900"
                      : "bg-white/5 text-zinc-400 group-hover:text-zinc-200"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[18px] w-[18px]"
                    aria-hidden
                  >
                    {ICONS[item.icon]}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-medium ${
                      active ? "text-gold-300" : "text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
