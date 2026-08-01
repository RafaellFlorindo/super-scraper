/**
 * Clona a página de vendas do concorrente e hospeda localmente.
 *
 * Dois cuidados que fazem toda a diferença:
 *
 * 1. **Os rastreadores do concorrente são removidos.** Se você clonar a página
 *    com o Pixel dele intacto, cada visita sua alimenta o público de
 *    remarketing DELE, com o seu dinheiro. É o erro mais caro de quem clona.
 *
 * 2. **Os links de compra são neutralizados.** Uma página clonada com o
 *    checkout original manda a venda para o concorrente. Aqui eles viram
 *    `#` e ficam marcados para você trocar.
 *
 * O clone serve para estudo de estrutura e como ponto de partida. Publicar cópia
 * literal de página alheia é violação de direito autoral: troque o texto, as
 * imagens e a oferta antes de usar.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";
import { pathFor } from "./storage";

/** Domínios de rastreamento que não podem sobreviver ao clone. */
const TRACKERS = [
  "connect.facebook.net", "facebook.com/tr", "fbevents.js",
  "googletagmanager.com", "google-analytics.com", "analytics.js", "gtag/js",
  "hotjar.com", "clarity.ms", "tiktok.com/i18n/pixel", "analytics.tiktok.com",
  "sc-static.net", "snap.licdn.com", "static.ads-twitter.com",
  "utmify", "pixel", "gtm.js",
];

/** Hosts de checkout: link de compra do concorrente não pode continuar vivo. */
const CHECKOUTS = [
  "hotmart", "kiwify", "eduzz", "monetizze", "braip", "ticto", "perfectpay",
  "cakto", "greenn", "hubla", "kirvano", "yampi", "doppus", "lastlink",
  "pay.", "checkout", "carrinho",
];

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export interface CloneResult {
  files: number;
  bytes: number;
  strippedTrackers: number;
}

export async function clonePage(cloneId: string): Promise<CloneResult> {
  const clone = await db.clonedPage.findUnique({ where: { id: cloneId } });
  if (!clone) throw new Error("Clone não encontrado");

  const dir = path.dirname(pathFor("clones", clone.id, "index.html"));
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
  });

  /** URL do asset -> nome do arquivo local. */
  const assets = new Map<string, string>();
  let bytes = 0;

  // Baixa os assets a partir das respostas que a própria página pediu. Assim
  // pegamos o que o CSS e o JS carregaram, e não só o que está no HTML.
  page.on("response", async (res) => {
    const url = res.url();
    const tipo = res.request().resourceType();
    if (!["stylesheet", "image", "font"].includes(tipo)) return;
    if (TRACKERS.some((t) => url.includes(t))) return;
    if (assets.has(url)) return;

    try {
      const body = await res.body();
      if (body.length > 8 * 1024 * 1024) return;

      const ext = (path.extname(new URL(url).pathname) || ".bin").split("?")[0].slice(0, 6);
      const nome = `${assets.size}${ext}`;
      fs.writeFileSync(path.join(dir, "assets", nome), body);
      assets.set(url, `assets/${nome}`);
      bytes += body.length;
    } catch {
      /* asset expirou ou é de outra origem */
    }
  });

  let strippedTrackers = 0;
  let title: string | null = null;

  try {
    await page.goto(clone.sourceUrl, { waitUntil: "networkidle", timeout: 60_000 });
    // dá tempo para lazy load e animações de entrada
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    title = await page.title();

    strippedTrackers = await page.evaluate(
      ({ trackers, checkouts }) => {
        let removidos = 0;

        // scripts de rastreamento, inline ou externos
        for (const s of Array.from(document.querySelectorAll("script"))) {
          const alvo = `${s.src} ${s.textContent?.slice(0, 3000) ?? ""}`.toLowerCase();
          if (trackers.some((t) => alvo.includes(t))) {
            s.remove();
            removidos++;
          }
        }

        // pixels em <img> e <iframe> escondidos
        for (const el of Array.from(document.querySelectorAll("img, iframe, noscript"))) {
          const src = (el.getAttribute("src") ?? el.innerHTML ?? "").toLowerCase();
          if (trackers.some((t) => src.includes(t))) {
            el.remove();
            removidos++;
          }
        }

        // links de compra do concorrente
        for (const a of Array.from(document.querySelectorAll("a[href]"))) {
          const href = (a.getAttribute("href") ?? "").toLowerCase();
          if (checkouts.some((c) => href.includes(c))) {
            a.setAttribute("data-checkout-original", a.getAttribute("href")!);
            a.setAttribute("href", "#");
          }
        }

        // formulários que enviariam lead para o concorrente
        for (const f of Array.from(document.querySelectorAll("form[action]"))) {
          f.setAttribute("data-action-original", f.getAttribute("action")!);
          f.setAttribute("action", "#");
        }

        return removidos;
      },
      { trackers: TRACKERS, checkouts: CHECKOUTS }
    );

    let html = await page.content();

    // reescreve as URLs absolutas para os arquivos que baixamos
    for (const [url, local] of assets) {
      html = html.split(url).join(local);
    }

    // <base> para o que sobrou de caminho relativo não quebrar
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1>\n<base href="${new URL(clone.sourceUrl).origin}/">\n` +
        `<!-- Clonado pelo Super Scraper a partir de ${clone.sourceUrl}\n` +
        `     Rastreadores removidos. Links de compra neutralizados.\n` +
        `     Troque textos, imagens e oferta antes de publicar. -->`
    );

    const indexPath = path.join(dir, "index.html");
    fs.writeFileSync(indexPath, html, "utf8");
    bytes += Buffer.byteLength(html);

    await page.screenshot({ path: path.join(dir, "preview.png"), fullPage: false });
  } finally {
    await browser.close();
  }

  const rel = path.relative(pathFor(""), dir).replaceAll("\\", "/");
  await db.clonedPage.update({
    where: { id: clone.id },
    data: {
      status: "done",
      localDir: rel,
      title,
      bytes,
      files: assets.size + 1,
      strippedTrackers,
      error: null,
    },
  });

  return { files: assets.size + 1, bytes, strippedTrackers };
}
