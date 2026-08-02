/**
 * Cliente da API do Higgsfield (image-to-video "DoP").
 *
 * Fluxo: envia a imagem + prompt de movimento, recebe um request_id e fica
 * consultando o status até `completed`, aí baixa o mp4. Autenticação por
 * par chave+segredo no header `Authorization: Key ID:SECRET`.
 *
 * A imagem local vai como data URI: o app roda no localhost e a API não
 * conseguiria buscar uma URL nossa.
 */
import fs from "node:fs";
import path from "node:path";
import { getSetting } from "./settings";
import { absolute } from "./storage";

const BASE = "https://platform.higgsfield.ai";

async function authHeader(): Promise<string> {
  const key = await getSetting("HIGGSFIELD_API_KEY");
  const secret = await getSetting("HIGGSFIELD_API_SECRET");
  if (!key || !secret) {
    throw new Error("Configure a Higgsfield API Key e o Secret em Configurações.");
  }
  return `Key ${key}:${secret}`;
}

function imageAsDataUri(relPath: string): string {
  const abs = absolute(relPath);
  if (!fs.existsSync(abs)) throw new Error(`Imagem não encontrada: ${relPath}`);
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
}

interface HfStatus {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw";
  request_id: string;
  video?: { url: string };
  error?: string;
}

/**
 * Gera o vídeo e devolve a URL do mp4 pronto. Pode levar minutos — quem chama
 * é o worker, nunca uma rota HTTP.
 */
export async function generateVideo(opts: {
  imageRelPath: string;
  prompt: string;
  model?: string;
}): Promise<{ videoUrl: string }> {
  const auth = await authHeader();

  const res = await fetch(`${BASE}/v1/image2video/dop`, {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        model: opts.model ?? "dop-turbo",
        prompt: opts.prompt,
        input_images: [{ type: "image_url", image_url: imageAsDataUri(opts.imageRelPath) }],
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Higgsfield ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const job = (await res.json()) as HfStatus & { status_url?: string };

  const statusUrl = job.status_url ?? `${BASE}/requests/${job.request_id}/status`;
  const TIMEOUT_MS = 10 * 60_000;
  const started = Date.now();

  while (Date.now() - started < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(statusUrl, { headers: { authorization: auth } });
    if (!st.ok) throw new Error(`Higgsfield status ${st.status}`);
    const data = (await st.json()) as HfStatus;

    if (data.status === "completed" && data.video?.url) return { videoUrl: data.video.url };
    if (data.status === "failed") throw new Error(`Higgsfield falhou: ${data.error ?? "sem detalhe"}`);
    if (data.status === "nsfw") throw new Error("Higgsfield recusou a imagem (filtro de conteúdo).");
  }

  throw new Error("Higgsfield: tempo esgotado esperando o vídeo (10 min).");
}
