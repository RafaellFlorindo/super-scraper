"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

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
    // O fundo (degradê, brilhos, pontos) agora é um único componente global
    // (AppBackground, no layout) atrás de sidebar + cabeçalho + conteúdo.
    // Antes vivia só aqui dentro (256px) e o resto da página era preto
    // chapado — dava uma emenda dura bem no topo, atrás do cabeçalho. A
    // aside só entra com a borda direita, que separa o menu do conteúdo.
    <aside className="relative w-64 shrink-0 border-r border-white/5">
      {/* sticky: o menu acompanha a rolagem em vez de sumir com a página */}
      <div className="fade-scroll sticky top-0 flex h-screen flex-col overflow-y-auto p-4">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          <Logo className="h-8 w-8 shrink-0" />
          <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            Super Scraper
          </span>
        </div>

        {/* itens maiores + mais espaçados: só 9 links num painel que estica até
            o fim da tela sobrava muito vazio embaixo com o tamanho antigo */}
        <nav className="flex-1 space-y-2.5">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 transition duration-200 ease-spring active:scale-[0.98] ${
                  active
                    ? "bg-gradient-to-r from-sun-500/25 to-transparent ring-1 ring-sun-400/40"
                    : "hover:bg-white/[0.07]"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition duration-200 ease-spring ${
                    active
                      ? "bg-sun-400 text-ink-900 shadow-[0_0_14px_rgba(232,194,100,0.35)]"
                      : "bg-white/[0.08] text-zinc-200 group-hover:text-white"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    {ICONS[item.icon]}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-medium ${
                      active ? "text-sun-300" : "text-zinc-100"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-zinc-400">{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
