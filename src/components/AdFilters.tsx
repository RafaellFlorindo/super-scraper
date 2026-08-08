"use client";

/**
 * Barra de filtro do Banco de Anúncios.
 *
 * Antes era um <form> puro que só filtrava depois de clicar em "Filtrar" — sem
 * indicação de quais filtros estavam ativos, e sem jeito rápido de tirar só um.
 * Aqui cada controle aplica na hora (a URL é a fonte da verdade, então dá pra
 * copiar o link já filtrado), e os filtros ativos viram chips removíveis
 * individualmente — o padrão que qualquer app de busca/e-commerce usa.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { campo, pill, linkGhost } from "@/lib/ui";

interface Option {
  value: string;
  label: string;
}

export default function AdFilters({
  niches,
  formats,
  runs,
}: {
  niches: Option[];
  formats: Option[];
  runs: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const get = (key: string, fallback = "") => searchParams.get(key) ?? fallback;
  const [q, setQ] = useState(get("q"));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // se a URL mudar por fora (ex: link "limpar tudo"), a busca acompanha
  useEffect(() => setQ(get("q")), [searchParams]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setParam("q", value), 450);
  }

  const tipo = get("tipo", "info");
  const niche = get("niche");
  const format = get("format");
  const min = get("min");
  const ordem = get("ordem", "escala");
  const run = get("run");

  const ativos: { key: string; label: string }[] = [
    ...(q ? [{ key: "q", label: `"${q}"` }] : []),
    ...(tipo !== "info" ? [{ key: "tipo", label: tipo === "local" ? "negócio local" : "todos os tipos" }] : []),
    ...(niche ? [{ key: "niche", label: niche }] : []),
    ...(format ? [{ key: "format", label: format }] : []),
    ...(min ? [{ key: "min", label: `escala ${min}+` }] : []),
    ...(ordem !== "escala" ? [{ key: "ordem", label: "mais recentes" }] : []),
    ...(run ? [{ key: "run", label: runs.find((r) => r.value === run)?.label ?? "coleta" }] : []),
  ];

  function limparUm(key: string) {
    if (key === "q") setQ("");
    setParam(key, "");
  }

  function limparTudo() {
    setQ("");
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por texto, headline ou anunciante..."
          className={`h-12 w-full pl-10 text-[15px] ${campo}`}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Tipo" value={tipo} onChange={(v) => setParam("tipo", v)}>
          <option value="info">Infoproduto/SaaS</option>
          <option value="local">Só negócio local</option>
          <option value="todos">Todos</option>
        </Campo>
        <Campo label="Nicho" value={niche} onChange={(v) => setParam("niche", v)}>
          <option value="">Todos os nichos</option>
          {niches.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </Campo>
        <Campo label="Formato" value={format} onChange={(v) => setParam("format", v)}>
          <option value="">Todos os formatos</option>
          {formats.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Campo>
        <Campo label="Escala mínima" value={min} onChange={(v) => setParam("min", v)}>
          <option value="">Qualquer</option>
          <option value="25">Testando+ (25)</option>
          <option value="50">Escalando+ (50)</option>
          <option value="75">Escaladíssimo (75)</option>
        </Campo>
        <Campo label="Ordenar por" value={ordem} onChange={(v) => setParam("ordem", v)}>
          <option value="escala">Maior escala</option>
          <option value="recentes">Minerados recentemente</option>
        </Campo>
        <Campo label="Coleta" value={run} onChange={(v) => setParam("run", v)}>
          <option value="">Todas as coletas</option>
          {runs.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Campo>
      </div>

      {ativos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-zinc-500">Filtros:</span>
          {ativos.map((a) => (
            <button
              key={a.key}
              onClick={() => limparUm(a.key)}
              className={`${pill} inline-flex items-center gap-1 bg-gold-500/10 text-gold-300 transition duration-200 ease-spring hover:bg-gold-500/20`}
            >
              {a.label}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button onClick={limparTudo} className={linkGhost}>
            limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={campo}>
        {children}
      </select>
    </label>
  );
}
