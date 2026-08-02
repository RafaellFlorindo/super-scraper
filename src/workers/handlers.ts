import fs from "node:fs";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import { download, absolute } from "../lib/storage.js";
import { chat } from "../lib/llm.js";
import { enqueue } from "../lib/ingest.js";
import { classifyInfoproduct } from "../lib/infoproduct.js";
import { getSetting } from "../lib/settings.js";

// -------------------------------------------------------------- mine
/**
 * Coleta disparada pela interface. Roda aqui dentro do worker de propósito:
 * abrir um processo novo no Windows faz piscar uma janela de console, e o
 * usuário acabava fechando o Chrome no meio da coleta.
 */
export async function handleMine(payload: { runId: string }) {
  const run = await db.miningRun.findUnique({ where: { id: payload.runId } });
  if (!run || run.status !== "running") return;

  const { mineAdLibrary } = await import("../scraper/adlibrary.js");
  const { ingestAd } = await import("../lib/ingest.js");

  let found = 0;
  let novos = 0;
  try {
    await mineAdLibrary({
      query: run.query,
      country: run.country,
      limit: run.limit,
      headless: (await getSetting("SCRAPER_HEADFUL")) !== "1",
      onAd: async (ad) => {
        const { isNew } = await ingestAd(ad, run.id);
        found++;
        if (isNew) novos++;
        await db.miningRun.update({ where: { id: run.id }, data: { found, novos } });
        // o retorno é o que faz o limite contar novidade, não repetição
        return isNew;
      },
    });
    await db.miningRun.update({
      where: { id: run.id },
      data: { status: "done", found, novos, endedAt: new Date() },
    });
    console.log(`  ✓ mine "${run.query}": ${found} vistos, ${novos} novos`);
  } catch (e) {
    await db.miningRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        found,
        novos,
        error: (e as Error).message.slice(0, 500),
        endedAt: new Date(),
      },
    });
    throw e;
  }
}

// -------------------------------------------------------------- media
/** Baixa imagens e vídeos do anúncio. Vídeos viram job de transcrição. */
export async function handleMedia(payload: { adId: string }) {
  const creatives = await db.creative.findMany({
    where: { adId: payload.adId, localPath: null },
  });

  const falhas: string[] = [];

  for (const c of creatives) {
    const ext = c.kind === "video" ? "mp4" : "jpg";
    try {
      const { localPath, bytes } = await download(c.sourceUrl, "creatives", payload.adId, `${c.id}.${ext}`);
      const hash = md5(absolute(localPath));

      // O mesmo vídeo chega em URLs diferentes (HD e SD, e assinatura nova a
      // cada re-coleta). Se este conteúdo já existe no anúncio, o registro é
      // descartado em vez de virar um player duplicado na tela.
      const gemeo = await db.creative.findFirst({
        where: { adId: payload.adId, contentHash: hash, id: { not: c.id } },
      });
      if (gemeo) {
        fs.rmSync(absolute(localPath), { force: true });
        await db.creative.delete({ where: { id: c.id } });
        continue;
      }

      await db.creative.update({
        where: { id: c.id },
        data: { localPath, bytes, contentHash: hash, downloadError: null },
      });
      if (c.kind === "video") await enqueue("transcribe", { creativeId: c.id });
    } catch (e) {
      // As URLs da Meta são assinadas e expiram: comum quando o download
      // demora a rodar. Antes o erro só ia pro console e o criativo ficava
      // com localPath null pra sempre, sem rastro nem chance de reparo — agora
      // fica registrado, e a falha ao final desta função faz o próprio job
      // ser tentado de novo (o worker já faz retry com backoff).
      const msg = (e as Error).message.slice(0, 300);
      await db.creative.update({
        where: { id: c.id },
        data: { downloadError: msg, downloadAttempts: { increment: 1 } },
      });
      falhas.push(`${c.id}: ${msg}`);
      console.warn(`  media: falhou ${c.id}: ${msg}`);
    }
  }

  if (falhas.length) {
    throw new Error(`${falhas.length} criativo(s) não baixaram: ${falhas.slice(0, 3).join(" | ")}`);
  }
}

// -------------------------------------------------------------- redownload
/**
 * Reparo manual: rebusca o anúncio na Ad Library para pegar URLs de mídia
 * frescas e tenta baixar de novo. Existe porque, depois de esgotar as
 * tentativas automáticas do `media`, uma URL assinada expirada nunca mais vai
 * funcionar sozinha — só pedindo de novo à Meta resolve.
 */
export async function handleRedownload(payload: { adId: string }) {
  const ad = await db.ad.findUnique({
    where: { id: payload.adId },
    include: { creatives: true },
  });
  if (!ad) return;

  const semMidia = ad.creatives.filter((c) => !c.localPath);
  if (!semMidia.length) return;

  const { refreshAdMedia } = await import("../scraper/adlibrary.js");
  const fresh = await refreshAdMedia(ad.libraryId, {
    headless: (await getSetting("SCRAPER_HEADFUL")) !== "1",
  });
  if (!fresh) {
    throw new Error("Anúncio não encontrado na Ad Library agora — pode ter sido removido pelo anunciante.");
  }

  // Casa por tipo e ordem: só toca nas URLs de quem ainda está sem mídia, as
  // que já baixaram ficam intactas.
  const porTipo: Record<"video" | "image", typeof fresh.creatives> = {
    video: fresh.creatives.filter((c) => c.kind === "video"),
    image: fresh.creatives.filter((c) => c.kind === "image"),
  };
  const usados = { video: 0, image: 0 };

  for (const c of semMidia) {
    const kind = c.kind as "video" | "image";
    const fresca = porTipo[kind]?.[usados[kind]];
    if (!fresca) continue;
    usados[kind]++;
    await db.creative
      .update({
        where: { id: c.id },
        data: { sourceUrl: fresca.sourceUrl, downloadError: null },
      })
      .catch(() => {
        /* colisão rara de unicidade — tenta de novo na próxima chamada manual */
      });
  }

  await handleMedia({ adId: payload.adId });
}

/** MD5 do arquivo, em streaming para não carregar vídeo inteiro na memória. */
export function md5(file: string): string {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

// -------------------------------------------------------------- transcribe
/**
 * Transcreve VSL via Groq (whisper-large-v3-turbo, free tier).
 * Limite de 25MB por request; vídeo maior que isso é pulado por ora.
 */
export async function handleTranscribe(payload: { creativeId: string }) {
  const c = await db.creative.findUnique({ where: { id: payload.creativeId } });
  if (!c?.localPath || c.transcript) return;
  // Falha em vez de retornar: assim o job fica em "failed" e `npm run jobs --
  // --retry` reprocessa tudo quando a chave for adicionada. Se retornasse, o
  // job viraria "done" e a VSL nunca seria transcrita.
  const groqKey = await getSetting("GROQ_API_KEY");
  if (!groqKey) throw new Error("Sem chave do Groq. Adicione em Configurações para transcrever a VSL.");

  const file = absolute(c.localPath);
  const size = fs.statSync(file).size;
  if (size > 24 * 1024 * 1024) {
    console.warn(`  transcribe: ${c.id} tem ${(size / 1e6).toFixed(1)}MB, acima do limite`);
    return;
  }

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)]), "vsl.mp4");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "text");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${groqKey}` },
    body: form,
  });

  if (!res.ok) {
    const detalhe = await res.text();

    // Vídeo mudo não é falha temporária: tentar de novo dá o mesmo erro para
    // sempre. Marca como transcrito com conteúdo vazio e encerra o assunto.
    if (detalhe.includes("no audio track")) {
      await db.creative.update({
        where: { id: c.id },
        data: { transcript: "", transcribedAt: new Date() },
      });
      console.log(`  transcribe: ${c.id} não tem áudio, marcado como sem narração`);
      return;
    }

    throw new Error(`groq whisper ${res.status}: ${detalhe}`);
  }

  await db.creative.update({
    where: { id: c.id },
    data: { transcript: await res.text(), transcribedAt: new Date() },
  });
}

// -------------------------------------------------------------- enrich
const CLASSIFY_PROMPT = `Você analisa anúncios de infoproduto do Facebook.
Responda SOMENTE um objeto JSON com estas chaves:
{
  "niche": "nicho específico, ex: 'confeitaria caseira', 'trade esportivo'",
  "angle": "o gatilho psicológico central, ex: 'renda extra', 'prova social', 'inimigo comum'",
  "format": "vsl | ugc | carrossel | estatico | depoimento",
  "language": "código ISO, ex: pt",
  "offerPrice": "preço se aparecer no texto, senão null"
}`;

export async function handleEnrich(payload: { adId: string }) {
  const ad = await db.ad.findUnique({
    where: { id: payload.adId },
    include: { creatives: true },
  });
  if (!ad) return;

  const transcript = ad.creatives.find((c) => c.transcript)?.transcript ?? "";
  const material = [
    `HEADLINE: ${ad.headline ?? "-"}`,
    `TEXTO: ${ad.primaryText ?? "-"}`,
    `CTA: ${ad.ctaText ?? "-"}`,
    transcript ? `TRANSCRIÇÃO DA VSL (início): ${transcript.slice(0, 3000)}` : "",
  ].join("\n");

  const raw = await chat(
    [
      { role: "system", content: CLASSIFY_PROMPT },
      { role: "user", content: material },
    ],
    { json: true }
  );

  const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());

  // Cada modelo devolve o JSON à sua maneira: número em offerPrice, array em
  // niche, a string "null". Normaliza tudo para texto ou null antes de gravar.
  const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = Array.isArray(v) ? v.join(", ") : String(v);
    const trimmed = s.trim();
    return trimmed && trimmed !== "null" && trimmed !== "N/A" ? trimmed.slice(0, 200) : null;
  };

  await db.ad.update({
    where: { id: ad.id },
    data: {
      niche: str(parsed.niche),
      angle: str(parsed.angle),
      format: str(parsed.format),
      language: str(parsed.language),
      offerPrice: str(parsed.offerPrice),
      classifiedAt: new Date(),
    },
  });
}

// -------------------------------------------------------------- funnel
/** Segue o link do anúncio e registra cada passo até o checkout. */
export async function handleFunnel(payload: { adId: string }) {
  const ad = await db.ad.findUnique({ where: { id: payload.adId } });
  if (!ad?.ctaUrl) return;

  const { chromium } = await import("playwright");
  // channel "chrome": o Chromium empacotado do Playwright não roda nesta máquina
  // (falta o VC++ Redistributable), então usamos o Chrome instalado.
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ locale: "pt-BR" });
  const steps: any[] = [];

  try {
    await page.goto(ad.ctaUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(3000);

    // o preço quase sempre está abaixo da dobra, perto do botão de compra —
    // sem rolar a página, seções com lazy load nem chegam a renderizar
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const text = await page.evaluate(() => document.body.innerText.slice(0, 40_000));
    const { extractPrice } = await import("../lib/price-extract.js");
    const price = extractPrice(text);

    steps.push({ url: page.url(), title: await page.title(), price });

    const host = new URL(page.url()).hostname;
    const platform =
      /hotmart/.test(host) ? "hotmart" :
      /kiwify/.test(host) ? "kiwify" :
      /kirvano/.test(host) ? "kirvano" :
      /cakto/.test(host) ? "cakto" :
      /eduzz/.test(host) ? "eduzz" :
      /monetizze/.test(host) ? "monetizze" :
      /ticto/.test(host) ? "ticto" :
      /perfectpay/.test(host) ? "perfectpay" :
      /greenn/.test(host) ? "greenn" :
      /hubla/.test(host) ? "hubla" :
      /lastlink/.test(host) ? "lastlink" :
      /braip/.test(host) ? "braip" :
      /wa\.me|whatsapp/.test(host) ? "whatsapp" :
      /instagram/.test(host) ? "instagram" : "proprio";

    // Reavalia infoproduto com a URL final: a ctaUrl costuma ser encurtador ou
    // redirecionador, então só agora sabemos onde o clique realmente cai.
    const info = classifyInfoproduct({
      ctaUrl: ad.ctaUrl,
      finalUrl: page.url(),
      advertiserName: (await db.advertiser.findUnique({ where: { id: ad.advertiserId } }))?.name,
      primaryText: ad.primaryText,
      headline: ad.headline,
      hasVideo: await db.creative.count({ where: { adId: ad.id, kind: "video" } }).then(Boolean),
    });
    await db.ad.update({
      where: { id: ad.id },
      data: { infoScore: info.score, isInfoproduct: info.isInfoproduct },
    });

    await db.funnel.upsert({
      where: { adId: ad.id },
      create: {
        adId: ad.id,
        finalUrl: page.url(),
        platform,
        detectedPrice: price,
        stepsJson: JSON.stringify(steps),
      },
      update: {
        finalUrl: page.url(),
        platform,
        detectedPrice: price,
        stepsJson: JSON.stringify(steps),
        analyzedAt: new Date(),
      },
    });
  } finally {
    await browser.close();
  }
}

// -------------------------------------------------------------- video
/**
 * Monta o vídeo do criativo. Roda na fila porque leva minutos: são vários
 * prints do browser, várias sínteses de voz e a montagem no ffmpeg.
 */
export async function handleVideo(payload: { renderId: string }) {
  const { renderVideo } = await import("../lib/video.js");
  await db.videoRender.update({
    where: { id: payload.renderId },
    data: { status: "running", error: null },
  });
  try {
    await renderVideo(payload.renderId);
  } catch (e) {
    await db.videoRender.update({
      where: { id: payload.renderId },
      data: { status: "failed", error: (e as Error).message.slice(0, 500) },
    });
    throw e;
  }
}

// ---------------------------------------------------------- hfvideo
/**
 * Vídeo por IA (Higgsfield): anima a imagem gerada do criativo. Fila porque a
 * geração leva minutos e a API é externa.
 */
export async function handleHfVideo(payload: { renderId: string }) {
  const render = await db.videoRender.findUnique({
    where: { id: payload.renderId },
    include: { creative: true },
  });
  if (!render) return;

  await db.videoRender.update({
    where: { id: render.id },
    data: { status: "running", error: null },
  });

  try {
    if (!render.creative.imagePath) {
      throw new Error("Este criativo ainda não tem imagem gerada — gere a imagem primeiro.");
    }

    const { generateVideo } = await import("../lib/higgsfield.js");
    const prompt =
      render.creative.imagePrompt ??
      render.creative.hook ??
      "Cinematic slow camera push-in, natural motion, high quality";

    const { videoUrl } = await generateVideo({
      imageRelPath: render.creative.imagePath,
      prompt,
    });

    const { download } = await import("../lib/storage.js");
    const saved = await download(videoUrl, "renders", render.id, "higgsfield.mp4");

    await db.videoRender.update({
      where: { id: render.id },
      data: { status: "done", localPath: saved.localPath },
    });
  } catch (e) {
    await db.videoRender.update({
      where: { id: render.id },
      data: { status: "failed", error: (e as Error).message.slice(0, 500) },
    });
    throw e;
  }
}

// -------------------------------------------------------------- clone
/** Clona a página de vendas do concorrente. Fila porque abre browser. */
export async function handleClone(payload: { cloneId: string }) {
  const { clonePage } = await import("../lib/clone.js");
  await db.clonedPage.update({
    where: { id: payload.cloneId },
    data: { status: "running", error: null },
  });
  try {
    await clonePage(payload.cloneId);
  } catch (e) {
    await db.clonedPage.update({
      where: { id: payload.cloneId },
      data: { status: "failed", error: (e as Error).message.slice(0, 500) },
    });
    throw e;
  }
}

export const HANDLERS: Record<string, (p: any) => Promise<void>> = {
  mine: handleMine,
  video: handleVideo,
  hfvideo: handleHfVideo,
  clone: handleClone,
  media: handleMedia,
  redownload: handleRedownload,
  transcribe: handleTranscribe,
  enrich: handleEnrich,
  funnel: handleFunnel,
};
