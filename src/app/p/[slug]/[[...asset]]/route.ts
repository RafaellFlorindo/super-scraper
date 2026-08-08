import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { absolute } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
};

/**
 * Serve a página clonada em /p/{slug}, e seus assets em /p/{slug}/assets/x.
 *
 * Fica fora da área autenticada de propósito: o objetivo é justamente
 * conseguir abrir o link em qualquer navegador.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; asset?: string[] }> }
) {
  const { slug, asset } = await ctx.params;

  const clone = await db.clonedPage.findUnique({ where: { slug } });
  if (!clone?.localDir || clone.status !== "done") {
    return new Response("Página não encontrada", { status: 404 });
  }

  const raiz = absolute(clone.localDir);
  const relativo = asset?.length ? asset.join("/") : "index.html";
  const arquivo = path.join(raiz, relativo);

  // impede sair da pasta do clone com ../ (e de uma pasta irmã com prefixo igual)
  const raizResolvida = path.resolve(raiz);
  const arquivoResolvido = path.resolve(arquivo);
  if (arquivoResolvido !== raizResolvida && !arquivoResolvido.startsWith(raizResolvida + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    return new Response("Não encontrado", { status: 404 });
  }

  const stat = fs.statSync(arquivo);
  return new Response(fs.createReadStream(arquivo) as any, {
    headers: {
      "content-type": TYPES[path.extname(arquivo).toLowerCase()] ?? "application/octet-stream",
      "content-length": String(stat.size),
      // conteúdo de terceiro: fora do índice de busca
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
