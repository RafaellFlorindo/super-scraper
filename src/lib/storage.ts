/**
 * Armazenamento de arquivos. Hoje: disco local. A interface existe para trocar
 * por R2/S3 depois sem tocar nos workers.
 */
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const ROOT = path.resolve("./storage");

export function pathFor(...parts: string[]) {
  const p = path.join(ROOT, ...parts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

/** Baixa uma URL para o disco. Retorna caminho relativo e tamanho. */
export async function download(url: string, ...parts: string[]) {
  const dest = pathFor(...parts);
  if (fs.existsSync(dest)) {
    return { localPath: path.relative(ROOT, dest), bytes: fs.statSync(dest).size };
  }
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: "https://www.facebook.com/" },
  });
  if (!res.ok) throw new Error(`download ${res.status} ${url.slice(0, 80)}`);
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(dest));
  return { localPath: path.relative(ROOT, dest), bytes: fs.statSync(dest).size };
}

export function absolute(relative: string) {
  return path.join(ROOT, relative);
}
