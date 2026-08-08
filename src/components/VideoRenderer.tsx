"use client";

import { useEffect, useState } from "react";
import { campoInset, btnAccent, linkGhost } from "@/lib/ui";

interface Render {
  id: string;
  status: string;
  localPath: string | null;
  durationSec: number | null;
  error: string | null;
}

const VOICES = [
  { id: "pt-BR-FranciscaNeural", label: "Francisca (feminina)" },
  { id: "pt-BR-ThalitaMultilingualNeural", label: "Thalita (mais natural)" },
  { id: "pt-BR-AntonioNeural", label: "Antônio (masculina)" },
];

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

/** Monta o vídeo do criativo e acompanha o progresso na fila. */
export default function VideoRenderer({
  creativeId,
  initial,
}: {
  creativeId: string;
  initial: Render[];
}) {
  const [renders, setRenders] = useState(initial);
  const [voice, setVoice] = useState(VOICES[0].id);
  const [engine, setEngine] = useState<"montagem" | "higgsfield">("montagem");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pendente = renders.some((r) => r.status === "pending" || r.status === "running");

  // enquanto houver render em andamento, pergunta o estado a cada 4s
  useEffect(() => {
    if (!pendente) return;
    const t = setInterval(async () => {
      const data = await fetch(`/api/video?creativeId=${creativeId}`).then((r) => r.json());
      setRenders(data.renders ?? []);
    }, 4000);
    return () => clearInterval(t);
  }, [pendente, creativeId]);

  async function gerar() {
    setBusy(true);
    setErro(null);
    const res = await fetch("/api/video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ generatedCreativeId: creativeId, voice, engine }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return setErro(data.error);

    const atual = await fetch(`/api/video?creativeId=${creativeId}`).then((r) => r.json());
    setRenders(atual.renders ?? []);
  }

  const pronto = renders.find((r) => r.status === "done" && r.localPath);
  const falhou = renders.find((r) => r.status === "failed");

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Vídeo</div>

      {pronto?.localPath ? (
        <div className="space-y-2">
          <video
            src={media(pronto.localPath)}
            controls
            className="max-h-96 rounded-xl border border-white/10"
          />
          <div className="flex items-center gap-3 text-xs">
            <a
              href={media(pronto.localPath)}
              download
              className="text-gold-400 transition duration-200 ease-spring hover:underline"
            >
              Baixar vídeo
            </a>
            {pronto.durationSec && (
              <span className="text-zinc-600">{pronto.durationSec.toFixed(0)}s</span>
            )}
            <button onClick={gerar} disabled={busy} className={linkGhost}>
              gerar outra versão
            </button>
          </div>
        </div>
      ) : pendente ? (
        <div className="flex items-center gap-2 text-xs text-gold-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-400" />
          Montando o vídeo, leva alguns minutos. Precisa do worker rodando.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as "montagem" | "higgsfield")}
            className={`!h-auto py-1.5 text-xs ${campoInset}`}
            title="Montagem: cenas narradas com voz. Higgsfield: anima a imagem gerada com IA."
          >
            <option value="montagem">Montagem narrada (grátis)</option>
            <option value="higgsfield">Higgsfield IA (anima a imagem)</option>
          </select>
          {engine === "montagem" && (
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className={`!h-auto py-1.5 text-xs ${campoInset}`}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          <button onClick={gerar} disabled={busy} className={`!h-auto px-3 py-1.5 text-xs ${btnAccent}`}>
            {busy ? "enviando..." : "Gerar vídeo"}
          </button>
        </div>
      )}

      {falhou?.error && !pronto && (
        <p className="mt-2 text-xs text-red-400">{falhou.error}</p>
      )}
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
    </div>
  );
}
