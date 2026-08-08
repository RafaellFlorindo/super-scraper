"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { card, campoInset, pill, btnPrimary, btnSecondary, btnAccent, linkGhost } from "@/lib/ui";

interface Clone {
  id: string;
  sourceUrl: string;
  slug: string;
  title: string | null;
  status: string;
  error: string | null;
  bytes: number;
  files: number;
  strippedTrackers: number;
  rebuildPrompt: string | null;
  localDir: string | null;
  createdAt: string;
}

const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;

export default function ClonePanel({
  initial,
  workerOnline,
}: {
  initial: Clone[];
  workerOnline: boolean;
}) {
  const router = useRouter();
  const [clones, setClones] = useState(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [promptAberto, setPromptAberto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const pendente = clones.some((c) => c.status === "pending" || c.status === "running");

  useEffect(() => {
    if (!pendente) return;
    const t = setInterval(async () => {
      const data = await fetch("/api/clone").then((r) => r.json());
      setClones(data.clones ?? []);
    }, 4000);
    return () => clearInterval(t);
  }, [pendente]);

  async function clonar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    const res = await fetch("/api/clone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return setErro(data.error);
    setUrl("");
    setClones((await fetch("/api/clone").then((r) => r.json())).clones ?? []);
  }

  async function remover(id: string) {
    await fetch("/api/clone", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setClones((c) => c.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className={`${card} p-5`}>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-medium text-zinc-300">Clonar uma página</h2>
          {!workerOnline && (
            <span className={`${pill} bg-red-500/15 text-red-400`}>worker parado</span>
          )}
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Baixa a página inteira, remove os rastreadores do concorrente e hospeda em{" "}
          <code className="text-zinc-400">/p/nome</code>.
        </p>

        <form onSubmit={clonar} className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://pagina-do-concorrente.com/vsl"
            disabled={!workerOnline}
            className={`min-w-64 flex-1 ${campoInset} placeholder:text-zinc-600 disabled:opacity-50`}
          />
          <button disabled={busy || !url.trim() || !workerOnline} className={btnPrimary}>
            {busy ? "Enfileirando..." : "Clonar"}
          </button>
        </form>

        {erro && <p className="mt-3 text-xs text-red-400">{erro}</p>}

        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          O clone serve para estudar estrutura. Publicar cópia literal de página alheia é
          violação de direito autoral: troque textos, imagens e oferta antes de usar.
        </p>
      </div>

      {clones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-sm text-zinc-500">
          Nenhuma página clonada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {clones.map((c) => (
            <div key={c.id} className={`${card} p-4`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-100">
                    {c.title ?? c.slug}
                  </div>
                  <div className="truncate text-xs text-zinc-600">{c.sourceUrl}</div>
                </div>
                <button
                  onClick={() => remover(c.id)}
                  className="shrink-0 text-xs text-zinc-600 transition duration-200 ease-spring hover:text-red-400"
                >
                  excluir
                </button>
              </div>

              {c.status === "done" ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>{c.files} arquivos</span>
                    <span>{mb(c.bytes)}</span>
                    {c.strippedTrackers > 0 && (
                      <span className="text-emerald-400">
                        {c.strippedTrackers} rastreador(es) removido(s)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/p/${c.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`!h-auto px-4 py-1.5 text-xs ${btnPrimary}`}
                    >
                      Abrir página
                    </a>
                    <code className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
                      /p/{c.slug}
                    </code>
                    <a
                      href={`/api/clone/prompt?id=${c.id}`}
                      download
                      className={`!h-auto px-4 py-1.5 text-xs ${btnAccent}`}
                      title="Prompt + código HTML da página, pronto para colar no Claude Code"
                    >
                      Prompt completo p/ Claude Code ↓
                    </a>
                    {c.rebuildPrompt && (
                      <button
                        onClick={() => {
                          setPromptAberto(promptAberto === c.id ? null : c.id);
                          setCopiado(false);
                        }}
                        className={`!h-auto px-4 py-1.5 text-xs ${btnSecondary}`}
                      >
                        {promptAberto === c.id ? "Fechar resumo" : "Ver resumo"}
                      </button>
                    )}
                  </div>
                  {promptAberto === c.id && c.rebuildPrompt && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-ink-900 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Cole isto no Claude Code
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.rebuildPrompt!);
                            setCopiado(true);
                          }}
                          className={linkGhost}
                        >
                          {copiado ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-400">
                        {c.rebuildPrompt}
                      </pre>
                    </div>
                  )}
                </>
              ) : c.status === "failed" ? (
                <p className="text-xs text-red-400">{c.error}</p>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gold-400">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-400" />
                  Clonando, leva alguns minutos.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
