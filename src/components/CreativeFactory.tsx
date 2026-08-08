"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VideoRenderer from "./VideoRenderer";
import { card, pill, btnPrimary, btnSecondary, linkGhost } from "@/lib/ui";

interface Generated {
  id: string;
  angle: string | null;
  hook: string | null;
  script: string | null;
  storyboard: string | null;
  primaryText: string | null;
  headline: string | null;
  imagePrompt: string | null;
  imagePath: string | null;
  renders: {
    id: string;
    status: string;
    localPath: string | null;
    durationSec: number | null;
    error: string | null;
  }[];
}

interface SourceCreative {
  id: string;
  kind: string;
  localPath: string | null;
  hasTranscript: boolean;
}

interface Props {
  projectId: string;
  sources: SourceCreative[];
  generated: Generated[];
}

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

export default function CreativeFactory({ projectId, sources, generated }: Props) {
  const router = useRouter();
  const [source, setSource] = useState(sources[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [imagens, setImagens] = useState<Record<string, "loading" | string>>({});

  async function gerar() {
    setBusy(true);
    setErro(null);
    const res = await fetch("/api/creatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "generate",
        projectId,
        sourceCreativeId: source || undefined,
        count: 5,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) setErro(data.error);
    else router.refresh();
  }

  async function gerarImagem(id: string) {
    setImagens((m) => ({ ...m, [id]: "loading" }));
    const res = await fetch("/api/creatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "image", generatedId: id }),
    });
    const data = await res.json();
    if (data.imagePath) {
      setImagens((m) => ({ ...m, [id]: data.imagePath }));
      router.refresh();
    } else {
      setImagens((m) => {
        const { [id]: _, ...resto } = m;
        return resto;
      });
      setErro(data.error);
    }
  }

  async function remover(id: string) {
    await fetch("/api/creatives", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className={`${card} p-5`}>
        <h2 className="mb-1 text-sm font-medium text-zinc-300">
          Gerar criativos da nossa oferta
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Usa o criativo do concorrente como molde de estrutura: hook, ritmo e tipo de prova.
          O texto é sempre original.
        </p>

        {sources.length === 0 ? (
          <p className="text-xs text-amber-400">
            Este projeto não tem criativo de referência baixado ainda. Deixe o worker rodando
            e volte aqui.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`overflow-hidden rounded-xl border transition duration-200 ease-spring active:scale-[0.98] ${
                    s.id === source
                      ? "border-gold-500/60"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  {s.localPath ? (
                    s.kind === "video" ? (
                      <video src={media(s.localPath)} className="h-24 w-40 object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media(s.localPath)} alt="" className="h-24 w-40 object-cover" />
                    )
                  ) : (
                    <div className="flex h-24 w-40 items-center justify-center text-xs text-zinc-600">
                      sem mídia
                    </div>
                  )}
                  <div className="bg-ink-900 px-2 py-1 text-[11px] text-zinc-500">
                    {s.kind === "video" ? "vídeo" : "imagem"}
                    {s.hasTranscript && <span className="text-emerald-400"> · com roteiro</span>}
                  </div>
                </button>
              ))}
            </div>

            <button onClick={gerar} disabled={busy} className={btnPrimary}>
              {busy ? "Gerando 5 variações..." : "Gerar 5 variações"}
            </button>
          </>
        )}

        {erro && <p className="mt-3 text-xs text-red-400">{erro}</p>}
      </div>

      {generated.map((g) => {
        const img = imagens[g.id] ?? g.imagePath;
        return (
          <div key={g.id} className={`${card} p-5`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className={`${pill} bg-gold-500/15 text-gold-400`}>
                  {g.angle ?? "sem ângulo"}
                </span>
                {g.headline && (
                  <h3 className="mt-2 font-medium text-zinc-100">{g.headline}</h3>
                )}
              </div>
              <button
                onClick={() => remover(g.id)}
                className="text-xs text-zinc-600 transition duration-200 ease-spring hover:text-red-400"
              >
                remover
              </button>
            </div>

            {g.hook && (
              <Bloco titulo="Hook (0 a 3s)">
                <p className="text-zinc-200">{g.hook}</p>
              </Bloco>
            )}
            {g.script && (
              <Bloco titulo="Roteiro falado">
                <p className="whitespace-pre-wrap text-zinc-300">{g.script}</p>
              </Bloco>
            )}
            {g.storyboard && (
              <Bloco titulo="Como gravar, cena a cena">
                <p className="whitespace-pre-wrap text-zinc-300">{g.storyboard}</p>
              </Bloco>
            )}
            {g.primaryText && (
              <Bloco titulo="Texto do anúncio">
                <p className="whitespace-pre-wrap text-zinc-300">{g.primaryText}</p>
              </Bloco>
            )}

            {g.imagePrompt && (
              <Bloco titulo="Visual">
                <p className="mb-2 text-xs text-zinc-500">{g.imagePrompt}</p>
                {img && img !== "loading" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media(img)} alt="" className="max-w-sm rounded-xl" />
                ) : (
                  <button
                    onClick={() => gerarImagem(g.id)}
                    disabled={img === "loading"}
                    className={`!h-auto px-3 py-1.5 text-xs ${btnSecondary} hover:border-gold-500/40 hover:text-gold-400 disabled:opacity-40`}
                  >
                    {img === "loading" ? "gerando imagem..." : "Gerar imagem"}
                  </button>
                )}
              </Bloco>
            )}

            <VideoRenderer creativeId={g.id} initial={g.renders} />

            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  [g.headline, g.hook, g.script, g.storyboard, g.primaryText]
                    .filter(Boolean)
                    .join("\n\n")
                )
              }
              className={`mt-3 ${linkGhost}`}
            >
              Copiar tudo
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">{titulo}</div>
      <div className="rounded-xl bg-ink-900/60 p-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
