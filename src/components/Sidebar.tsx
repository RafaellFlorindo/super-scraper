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
  historico: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4M12 7v5l3 2" />
    </>
  ),
  clones: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 5H5a2 2 0 0 0-2 2v10" />
    </>
  ),
  analise: (
    <>
      <path d="M3 20h18" />
      <path d="M5 17 10 11l4 3 5-7" />
      <circle cx="19" cy="7" r="1.4" />
    </>
  ),
  hacking: (
    <>
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.6-3.6 4.6-5.4 7.5-5.4s5.9 1.8 7.5 5.4" />
    </>
  ),
};

// Ordem pensada como um funil de uso: minerar -> ver quem escala -> produzir
// -> mapear destino -> clonar -> acompanhar o próprio resultado.
// Configurações sempre por último.
const NAV = [
  { href: "/", icon: "banco", label: "Banco de Anúncios", hint: "minerar e filtrar" },
  { href: "/historico", icon: "historico", label: "Histórico", hint: "quem está escalando" },
  { href: "/projetos", icon: "agentes", label: "Estúdio de Agentes", hint: "modelar e criar" },
  { href: "/funis", icon: "funis", label: "Mapa de Funis", hint: "destinos mapeados" },
  { href: "/funil-hacking", icon: "hacking", label: "Funil Hacking", hint: "faturamento estimado" },
  { href: "/analise-ofertas", icon: "analise", label: "Análise de Ofertas", hint: "subindo ou caindo" },
  { href: "/clones", icon: "clones", label: "Páginas Clonadas", hint: "clonar e hospedar" },
  { href: "/perfil", icon: "perfil", label: "Meu Perfil", hint: "conta e conquistas" },
  { href: "/config", icon: "config", label: "Configurações", hint: "chaves e coleta" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    // O aside estica na altura toda da página (flex stretch): numa página
    // curta (Funil Hacking) essa altura é ~a tela, numa longa (Banco de
    // Anúncios com dezenas de cards) é vários "scrolls" de altura. A
    // decoração antiga usava `absolute inset-0` DENTRO do aside, então
    // "bottom-0"/"top-16" eram relativos a essa altura variável — o degradê e
    // os brilhos apareciam esticados ou espremidos de forma diferente em cada
    // rota. Trocado para `fixed`, preso à viewport: sempre a mesma altura,
    // sempre o mesmo desenho, não importa o tamanho da página.
    <aside className="relative w-64 shrink-0 border-r border-white/5">
      <div className="pointer-events-none fixed inset-y-0 left-0 w-64 overflow-hidden">
        {/* degradê vertical preto/roxo com brilho branco subindo do rodapé */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1030] via-black to-black" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white/[0.09] via-[#4f2fd0]/25 to-transparent" />
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#4f46e5]/25 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-60 w-60 rounded-full bg-gold-500/20 blur-3xl" />
        {/* textura de pontos, como no cartão do plano */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: "radial-gradient(circle, #a5a0ff 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold-500/25 to-transparent" />
      </div>

      {/* sticky: o menu acompanha a rolagem em vez de sumir com a página */}
      <div className="fade-scroll sticky top-0 flex h-screen flex-col overflow-y-auto p-4">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          {/* selo violeta com linha de pulso: a marca é "acompanhar o mercado",
              e o gráfico subindo diz isso melhor que o raio antigo */}
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8f88ff" />
                <stop offset="1" stopColor="#5b4fe0" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#logo-grad)" />
            <path
              d="M7 21l5-6 4 3.5L21.5 11l3.5 4"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="25" cy="15" r="1.6" fill="#fff" />
          </svg>
          <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            Super Scraper
          </span>
        </div>

        <nav className="flex-1 space-y-1.5">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition duration-200 ease-spring active:scale-[0.98] ${
                  active
                    ? "bg-gradient-to-r from-sun-500/25 to-transparent ring-1 ring-sun-400/40"
                    : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition duration-200 ease-spring ${
                    active
                      ? "bg-sun-400 text-ink-900 shadow-[0_0_14px_rgba(232,194,100,0.35)]"
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
                      active ? "text-sun-300" : "text-zinc-200"
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
