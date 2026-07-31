/**
 * Monta o vídeo do criativo a partir do roteiro gerado.
 *
 * NÃO é geração generativa de vídeo (Veo, Kling e afins), que é paga. Aqui o
 * vídeo é MONTADO, com peças que já temos de graça:
 *
 *   narração  -> edge-tts, vozes neurais da Microsoft em pt-BR
 *   cenas     -> HTML renderizado no Chrome via Playwright, um print por cena
 *   montagem  -> ffmpeg que já vem junto com o Playwright
 *
 * A duração de cada cena sai do áudio narrado, não de um chute: a cena dura o
 * tempo exato da fala, senão o vídeo fica dessincronizado.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { db } from "./db";
import { chat } from "./llm";
import { pathFor, absolute } from "./storage";

const run = promisify(execFile);

// ------------------------------------------------------------ dependências

/**
 * Caminho do ffmpeg.
 *
 * Usa o pacote `ffmpeg-static`, que baixa uma build completa. Importante NÃO
 * usar o ffmpeg que vem com o Playwright: aquele é uma build reduzida para
 * gravar tela, só tem VP8 e nenhum encoder de áudio, então não consegue montar
 * um mp4 com narração.
 */
export function ffmpegPath(): string {
  try {
    // createRequire porque este módulo roda como ESM, onde require não existe
    const req = createRequire(import.meta.url);
    const mod = req("ffmpeg-static");
    const exe = typeof mod === "string" ? mod : mod?.default;
    if (exe && fs.existsSync(exe)) return exe;
  } catch {
    /* não instalado */
  }
  return "ffmpeg"; // cai no PATH
}

export async function checkDeps(): Promise<{ ok: boolean; missing: string[] }> {
  const missing: string[] = [];
  try {
    await run(ffmpegPath(), ["-version"]);
  } catch {
    missing.push("ffmpeg");
  }
  try {
    await run("python", ["-c", "import edge_tts"]);
  } catch {
    missing.push("edge-tts (rode: pip install edge-tts)");
  }
  return { ok: missing.length === 0, missing };
}

// ------------------------------------------------------------ planejamento

export interface Scene {
  narration: string;
  onScreenText: string;
  /** Preenchido depois, com a duração real do áudio. */
  seconds?: number;
}

const PLAN_SYSTEM = `Você transforma um roteiro de anúncio em cenas para um vídeo vertical.

Responda SOMENTE um array JSON, sem markdown:
[
  { "narration": "o que a locução fala nesta cena", "onScreenText": "texto curto na tela" }
]

Regras:
- Entre 4 e 7 cenas.
- "narration" é fala natural, em português do Brasil, 1 ou 2 frases por cena.
- "onScreenText" tem no máximo 8 palavras. É legenda de impacto, não a fala inteira.
- A primeira cena é o gancho, precisa prender em 3 segundos.
- A última cena é a chamada para ação.
- Não use travessão. Não invente número, prêmio ou depoimento.`;

export async function planScenes(creativeId: string): Promise<Scene[]> {
  const c = await db.generatedCreative.findUnique({ where: { id: creativeId } });
  if (!c) throw new Error("Criativo não encontrado");

  const material = [
    c.headline && `HEADLINE: ${c.headline}`,
    c.hook && `HOOK: ${c.hook}`,
    c.script && `ROTEIRO FALADO: ${c.script}`,
    c.storyboard && `STORYBOARD: ${c.storyboard}`,
    c.primaryText && `TEXTO DO ANÚNCIO: ${c.primaryText}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Modelos menores costumam devolver uma cena só e dar por encerrado, então
  // o número é validado e a chamada é refeita com cobrança explícita.
  let cenas = await tentarPlanejar(material, "");
  if (cenas.length < 3) {
    cenas = await tentarPlanejar(
      material,
      `\n\nATENÇÃO: sua resposta anterior teve ${cenas.length} cena(s), o que é ` +
        `insuficiente. O array PRECISA ter no mínimo 4 e no máximo 7 objetos. ` +
        `Quebre o roteiro em momentos: gancho, problema, solução, prova, oferta, CTA.`
    );
  }

  if (cenas.length < 2) {
    throw new Error(
      `A IA planejou só ${cenas.length} cena(s). Tente de novo, ou use um modelo melhor em Configurações.`
    );
  }
  return cenas.slice(0, 7);
}

async function tentarPlanejar(material: string, reforco: string): Promise<Scene[]> {
  const raw = await chat(
    [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: material + reforco },
    ],
    { json: true }
  );

  const limpo = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpo);
  } catch {
    const m = limpo.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("A IA não devolveu cenas em JSON válido.");
    parsed = JSON.parse(m[0]);
  }

  // aceita array puro, objeto embrulhando o array, ou um objeto de cena solto
  let lista: unknown[];
  if (Array.isArray(parsed)) {
    lista = parsed;
  } else {
    const arr = Object.values(parsed as object).find(Array.isArray) as unknown[] | undefined;
    lista = arr ?? ("narration" in (parsed as object) ? [parsed] : []);
  }

  return lista
    .map((s: any) => ({
      narration: String(s?.narration ?? "").trim(),
      onScreenText: String(s?.onScreenText ?? "").trim(),
    }))
    .filter((s) => s.narration);
}

// ------------------------------------------------------------------- áudio

/** Sintetiza a narração e devolve o caminho do mp3. */
async function narrate(text: string, voice: string, dest: string) {
  await run("python", [
    "-m",
    "edge_tts",
    "--voice",
    voice,
    "--text",
    text,
    "--write-media",
    dest,
    // um pouco mais rápido: locução de anúncio não é audiobook
    "--rate=+8%",
  ]);
  return dest;
}

/** Duração real do áudio, para a cena durar exatamente o tempo da fala. */
async function audioSeconds(file: string): Promise<number> {
  const { stderr } = await run(ffmpegPath(), ["-i", file], { encoding: "utf8" }).catch(
    (e: any) => ({ stderr: String(e.stderr ?? "") })
  );
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
  if (!m) return 3;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// -------------------------------------------------------------------- cena

/**
 * Cada cena é uma página HTML fotografada pelo Chrome.
 *
 * Usar o browser em vez do filtro drawtext do ffmpeg dá tipografia decente,
 * quebra de linha automática e gradiente, sem depender de fonte instalada.
 */
function sceneHtml(text: string, index: number, total: number, bg?: string) {
  const paletas = [
    ["#0f172a", "#1e293b"],
    ["#18181b", "#3f3f46"],
    ["#1c1917", "#44403c"],
    ["#0c0a09", "#292524"],
  ];
  const [a, b] = paletas[index % paletas.length];

  const fundo = bg
    ? `background-image:url('file:///${bg.replaceAll("\\", "/")}');background-size:cover;background-position:center;`
    : `background:linear-gradient(160deg, ${a}, ${b});`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1080px;height:1920px;${fundo}display:flex;align-items:center;
      justify-content:center;font-family:'Segoe UI',system-ui,sans-serif;position:relative}
    .veu{position:absolute;inset:0;background:rgba(0,0,0,.45)}
    .txt{position:relative;padding:0 90px;text-align:center;color:#fff;
      font-size:104px;font-weight:800;line-height:1.15;
      text-shadow:0 6px 30px rgba(0,0,0,.6)}
    .barra{position:absolute;bottom:0;left:0;height:14px;background:#e8c264;
      width:${((index + 1) / total) * 100}%}
  </style></head><body>
    ${bg ? '<div class="veu"></div>' : ""}
    <div class="txt">${text.replace(/[<>]/g, "")}</div>
    <div class="barra"></div>
  </body></html>`;
}

// ------------------------------------------------------------------ render

export async function renderVideo(renderId: string) {
  const render = await db.videoRender.findUnique({
    where: { id: renderId },
    include: { creative: true },
  });
  if (!render) throw new Error("Render não encontrado");

  const deps = await checkDeps();
  if (!deps.ok) throw new Error(`Faltam dependências: ${deps.missing.join(", ")}`);

  const dir = path.dirname(pathFor("videos", render.id, "x"));
  fs.mkdirSync(dir, { recursive: true });

  const cenas: Scene[] = JSON.parse(render.scenesJson);
  if (!cenas.length) throw new Error("Nenhuma cena para renderizar.");

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const clipes: string[] = [];
  try {
    for (let i = 0; i < cenas.length; i++) {
      const cena = cenas[i];
      const base = path.join(dir, `cena-${i}`);

      // fundo opcional: imagem do próprio criativo, quando já foi gerada
      const bg =
        render.creative.imagePath && fs.existsSync(absolute(render.creative.imagePath))
          ? absolute(render.creative.imagePath)
          : undefined;

      await page.setContent(sceneHtml(cena.onScreenText || cena.narration, i, cenas.length, bg));
      await page.screenshot({ path: `${base}.png` });

      await narrate(cena.narration, render.voice, `${base}.mp3`);
      const dur = await audioSeconds(`${base}.mp3`);
      cena.seconds = dur;

      // imagem parada + narração -> clipe com a duração exata da fala
      await run(ffmpegPath(), [
        "-y",
        "-loop", "1",
        "-i", `${base}.png`,
        "-i", `${base}.mp3`,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-r", "30",
        `${base}.mp4`,
      ]);
      clipes.push(`${base}.mp4`);
    }
  } finally {
    await browser.close();
  }

  // concat demuxer: os clipes já têm o mesmo formato, então não recodifica
  const lista = path.join(dir, "lista.txt");
  fs.writeFileSync(lista, clipes.map((c) => `file '${c.replaceAll("\\", "/")}'`).join("\n"));

  const final = path.join(dir, "final.mp4");
  await run(ffmpegPath(), [
    "-y", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", final,
  ]);

  const rel = path.relative(pathFor(""), final).replaceAll("\\", "/");
  const total = cenas.reduce((a, c) => a + (c.seconds ?? 0), 0);

  await db.videoRender.update({
    where: { id: render.id },
    data: {
      status: "done",
      localPath: rel,
      durationSec: total,
      scenesJson: JSON.stringify(cenas),
      error: null,
    },
  });

  // limpa os intermediários, que somam bem mais que o vídeo final
  for (const c of clipes) {
    fs.rmSync(c, { force: true });
    fs.rmSync(c.replace(".mp4", ".png"), { force: true });
    fs.rmSync(c.replace(".mp4", ".mp3"), { force: true });
  }
  fs.rmSync(lista, { force: true });

  return rel;
}

export const VOICES = [
  { id: "pt-BR-FranciscaNeural", label: "Francisca (feminina)" },
  { id: "pt-BR-ThalitaMultilingualNeural", label: "Thalita (feminina, mais natural)" },
  { id: "pt-BR-AntonioNeural", label: "Antônio (masculina)" },
];
