import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { absolute } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Prompt COMPLETO para o Claude Code reconstruir a página: o resumo de
 * estrutura (rebuildPrompt) + o próprio HTML clonado, limpo do que só
 * atrapalha (scripts, svgs gigantes, data-URIs). Com o código de verdade no
 * prompt, o Claude reproduz layout e estilo fielmente — o resumo sozinho
 * gerava página "mais ou menos parecida".
 *
 * Baixa como arquivo .md em vez de copiar para a área de transferência:
 * o HTML passa fácil de 100 KB e clipboard trava com isso.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("id obrigatório", { status: 400 });

  const clone = await db.clonedPage.findUnique({ where: { id } });
  if (!clone?.localDir) return new Response("clone não encontrado", { status: 404 });

  const indexPath = path.join(absolute(clone.localDir), "index.html");
  if (!fs.existsSync(indexPath)) return new Response("html não encontrado", { status: 404 });

  let html = fs.readFileSync(indexPath, "utf8");

  // corta o que não ajuda o Claude a reproduzir o visual e só come contexto
  html = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/data:[a-z/+;]*base64,[A-Za-z0-9+/=]{200,}/g, "data:removido")
    .replace(/<svg\b[\s\S]{2000,}?<\/svg>/gi, "<svg><!-- svg grande removido --></svg>")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n");

  // teto de segurança: além disso nem o Claude precisa
  const LIMITE = 300_000;
  const cortado = html.length > LIMITE;
  if (cortado) html = html.slice(0, LIMITE) + "\n<!-- html truncado aqui -->";

  const md = [
    clone.rebuildPrompt ??
      `Recrie a página de vendas "${clone.title ?? clone.sourceUrl}" em Next.js (App Router, Tailwind), com texto, imagens e oferta 100% originais.`,
    "",
    "---",
    "",
    "## Código-fonte da página original (limpo, sem scripts)",
    "",
    "Use este HTML como referência FIEL de layout, hierarquia, espaçamento e estilo.",
    "Reproduza a estrutura visual, mas reescreva todo o texto para a nossa oferta e",
    "troque as imagens. Não reaproveite classes minificadas: reescreva em Tailwind limpo.",
    cortado ? "(O HTML foi truncado por tamanho — o padrão visual se repete.)" : "",
    "",
    "```html",
    html,
    "```",
    "",
  ].join("\n");

  const nome = `prompt-${clone.slug}.md`;
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
    },
  });
}
