import fs from "node:fs";
import path from "node:path";
import { absolute } from "@/lib/storage";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Serve os criativos baixados de ./storage.
 *
 * Implementa HTTP Range (206 Partial Content) porque sem isso o player de vídeo
 * não deixa arrastar a barra de progresso: o navegador precisa pedir um trecho
 * arbitrário do arquivo para pular no tempo, e um 200 com o arquivo inteiro só
 * permite assistir do começo.
 */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");

  // impede escapar da pasta storage via ../
  const file = absolute(rel);
  if (!file.startsWith(absolute(""))) return new Response("Forbidden", { status: 403 });
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });

  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    // formato: "bytes=INICIO-FIM", com FIM opcional
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

      if (start >= size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "content-range": `bytes */${size}` },
        });
      }

      return new Response(fs.createReadStream(file, { start, end }) as any, {
        status: 206,
        headers: {
          "content-type": type,
          "content-length": String(end - start + 1),
          "content-range": `bytes ${start}-${end}/${size}`,
          "accept-ranges": "bytes",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  return new Response(fs.createReadStream(file) as any, {
    headers: {
      "content-type": type,
      "content-length": String(size),
      // anuncia o suporte a Range para o player já saber que pode buscar
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
