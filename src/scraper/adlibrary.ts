/**
 * Coletor da Ad Library pública da Meta.
 *
 * A página é um SPA React sem API pública para anúncios comerciais — a API
 * oficial (graph.facebook.com/ads_archive) só devolve anúncios políticos.
 * Então a estratégia é: abrir a busca num browser real, interceptar as
 * respostas GraphQL que a própria página faz, e ler os dados de lá em vez de
 * raspar o DOM. O DOM da Meta muda de classe toda semana; o payload GraphQL é
 * bem mais estável.
 *
 * Roda no IP residencial do usuário, headful e devagar de propósito.
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Fora do projeto de propósito: o Chrome se recusa a subir (spawn UNKNOWN) com
// user-data-dir dentro do OneDrive ou em caminho com acento.
const USER_DATA_DIR = path.join(os.homedir(), ".scrapper", "browser-profile");

export interface RawAd {
  libraryId: string;
  pageId: string;
  pageName: string;
  pageUrl?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  platforms: string[];
  countries: string[];
  startedAt?: Date;
  isActive: boolean;
  /** Quantos cards a Meta agrupou sob este anúncio — proxy de nº de variações. */
  variantCount: number;
  creatives: { kind: "image" | "video"; sourceUrl: string }[];
  raw: unknown;
}

export interface MineOptions {
  /** Termo de busca, ex: "curso de confeitaria". */
  query: string;
  country?: string;
  /**
   * Quantos anúncios INÉDITOS coletar.
   *
   * Conta só o que o `onAd` reportar como novo. Se contasse tudo que aparece,
   * repetir uma busca já feita pararia nos primeiros resultados, que são sempre
   * os mesmos, e nunca traria nada novo.
   */
  limit?: number;
  /** Só anúncios que começaram a rodar depois desta data. */
  startedAfter?: Date;
  /**
   * Padrão: headless (nada aparece na tela). Passe false, ou defina
   * SCRAPER_HEADFUL=1 no .env, para ver a janela — útil se a Meta pedir captcha
   * ou login e você precisar resolver na mão uma vez. Como o perfil do browser
   * é persistente, resolver uma vez vale para as próximas coletas.
   */
  headless?: boolean;
  /**
   * Devolva `true` quando o anúncio for inédito. É o que faz o `limit` contar
   * novidade em vez de repetição.
   */
  onAd?: (ad: RawAd) => Promise<boolean | void> | boolean | void;
  /** Chamado a cada rolagem, para a interface mostrar o progresso real. */
  onProgress?: (p: { vistos: number; novos: number }) => void;
}

function buildSearchUrl(o: MineOptions) {
  const p = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: o.country ?? "BR",
    q: o.query,
    search_type: "keyword_unordered",
    media_type: "all",
  });

  // A Ad Library aceita recorte por data de início. É a forma mais direta de
  // achar anúncio que ainda não está no banco quando o termo já foi minerado.
  if (o.startedAfter) {
    p.set("start_date[min]", o.startedAfter.toISOString().slice(0, 10));
    p.set("start_date[max]", "");
  }

  return `https://www.facebook.com/ads/library/?${p}`;
}

/** A Meta aninha o anúncio em profundidades diferentes conforme a query GraphQL. */
function collectAdNodes(value: unknown, out: any[] = []): any[] {
  if (value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const v of value) collectAdNodes(v, out);
    return out;
  }
  const obj = value as Record<string, unknown>;
  // assinatura mínima de um card de anúncio no payload da Ad Library
  if ("adArchiveID" in obj || "ad_archive_id" in obj) out.push(obj);
  for (const v of Object.values(obj)) collectAdNodes(v, out);
  return out;
}

/** Alguns campos vêm como string, outros como `{ text: "..." }`. */
function pick<T = string>(o: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    let v = o?.[k];
    if (v && typeof v === "object" && "text" in v) v = v.text;
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

function normalize(node: any): RawAd | null {
  const libraryId = String(pick(node, "adArchiveID", "ad_archive_id") ?? "");
  if (!libraryId) return null;

  const snap = node.snapshot ?? {};
  // Carrossel: um card por slide em snapshot.cards[], cada um com sua mídia.
  // Anúncio simples: cards vazio, mídia em snapshot.videos[] / snapshot.images[].
  //
  // Os dois nunca são somados: quando cards existe, a Meta repete a mesma mídia
  // em snapshot.videos, e somar traria cada vídeo duas vezes.
  const cards: any[] = Array.isArray(snap.cards) ? snap.cards : [];
  const sources = cards.length
    ? cards
    : [
        ...(Array.isArray(snap.videos) ? snap.videos : []),
        ...(Array.isArray(snap.images) ? snap.images : []),
      ];

  const creatives: RawAd["creatives"] = [];
  const seen = new Set<string>();
  for (const c of sources) {
    const video = pick(c, "video_hd_url", "video_sd_url", "videoHdUrl", "videoSdUrl");
    if (video && !seen.has(video)) {
      seen.add(video);
      creatives.push({ kind: "video", sourceUrl: video });
    }
    const image = pick(c, "original_image_url", "resized_image_url", "originalImageURL");
    if (image && !seen.has(image)) {
      seen.add(image);
      creatives.push({ kind: "image", sourceUrl: image });
    }
  }

  // texto: card do carrossel tem prioridade, senão cai no snapshot
  const textSource = cards[0] ?? {};

  const startTs = pick<number>(node, "startDate", "start_date", "ad_delivery_start_time");

  return {
    libraryId,
    pageId: String(pick(node, "pageID", "page_id") ?? "unknown"),
    pageName: String(pick(node, "pageName", "page_name") ?? "Desconhecido"),
    pageUrl: pick(snap, "page_profile_uri"),
    primaryText: pick(textSource, "body") ?? pick(snap, "body"),
    headline: pick(textSource, "title", "headline") ?? pick(snap, "title"),
    description: pick(textSource, "link_description", "caption") ?? pick(snap, "link_description", "caption"),
    ctaText: pick(textSource, "cta_text") ?? pick(snap, "cta_text"),
    ctaUrl: pick(textSource, "link_url") ?? pick(snap, "link_url"),
    platforms: pick<string[]>(node, "publisherPlatform", "publisher_platform") ?? [],
    countries:
      pick<string[]>(node, "targeted_or_reached_countries", "reachedCountries", "reached_countries") ?? [],
    startedAt: typeof startTs === "number" ? new Date(startTs * 1000) : undefined,
    isActive: pick<boolean>(node, "isActive", "is_active") ?? true,
    variantCount: Number(pick(node, "collationCount", "collation_count") ?? 1),
    creatives,
    raw: node,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Pausa aleatória — cadência humana atrapalha muito o fingerprinting da Meta. */
const humanPause = () => sleep(1200 + Math.random() * 2300);

export async function mineAdLibrary(opts: MineOptions): Promise<RawAd[]> {
  const limit = opts.limit ?? 50;
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  // Perfil persistente: cookies e fingerprint sobrevivem entre execuções, o que
  // faz a Meta te tratar como visitante recorrente em vez de bot novo.
  const ctx: BrowserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
    // Chrome instalado em vez do Chromium do Playwright: o build do Playwright
    // exige o VC++ Redistributable, e o Chrome real ainda passa melhor pelo
    // fingerprinting da Meta.
    channel: "chrome",
    headless: opts.headless ?? process.env.SCRAPER_HEADFUL !== "1",
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    // Sem isto o Chrome headless se anuncia como "HeadlessChrome" no user-agent,
    // que é o primeiro campo que qualquer anti-bot olha.
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  // navigator.webdriver = true entrega automação mesmo com o user-agent limpo.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const found = new Map<string, RawAd>();
  /** Só o que o chamador confirmou como inédito conta para o limite. */
  let novos = 0;
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());

  page.on("response", async (res) => {
    if (!res.url().includes("/api/graphql")) return;
    let body: string;
    try {
      body = await res.text();
    } catch {
      return;
    }
    // respostas da Meta vêm como JSON stream: um objeto por linha
    for (const line of body.split("\n")) {
      if (!line.trim().startsWith("{")) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      for (const node of collectAdNodes(parsed)) {
        const ad = normalize(node);
        if (ad && !found.has(ad.libraryId)) {
          found.set(ad.libraryId, ad);
          if ((await opts.onAd?.(ad)) === true) novos++;
        }
      }
    }
  });

  await page.goto(buildSearchUrl(opts), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await humanPause();

  /**
   * Rolagem infinita até juntar `limit` anúncios INÉDITOS.
   *
   * O corte por novidade, e não por total visto, é o que permite aprofundar num
   * termo já minerado: os primeiros resultados da Ad Library são sempre os
   * mesmos, então parar no total faria toda re-busca voltar de mãos vazias.
   *
   * Dois freios evitam rolar para sempre: `PACIENCIA` quando a página para de
   * carregar mais nada, e `MAX_VISTOS` para não varrer o catálogo inteiro atrás
   * de um punhado de novidades.
   */
  const PACIENCIA = 6;
  const MAX_VISTOS = Math.max(400, limit * 25);

  let semNovidade = 0;
  while (novos < limit && semNovidade < PACIENCIA && found.size < MAX_VISTOS) {
    const antesVistos = found.size;
    await page.mouse.wheel(0, 900 + Math.random() * 700);
    await humanPause();

    // conta como estagnação quando a página não trouxe MAIS NADA, nem repetido:
    // aí é fim da lista, não apenas uma faixa de anúncios já conhecidos
    semNovidade = found.size === antesVistos ? semNovidade + 1 : 0;
    opts.onProgress?.({ vistos: found.size, novos });
  }

  await ctx.close();
  return [...found.values()];
}
