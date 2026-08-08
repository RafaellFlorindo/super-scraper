import fs from "node:fs";
import { db } from "@/lib/db";
import { slugify } from "@/lib/clone";
import { absolute } from "@/lib/storage";

export const runtime = "nodejs";

/** Enfileira a clonagem de uma página. Quem executa é o worker. */
export async function POST(req: Request) {
  const { url, adId } = (await req.json()) as { url: string; adId?: string };

  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return Response.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(alvo.protocol)) {
    return Response.json({ error: "Só http e https" }, { status: 400 });
  }

  // slug legível a partir do domínio, com sufixo para não colidir
  const base = slugify(alvo.hostname.replace(/^www\./, "")) || "pagina";
  let slug = base;
  for (let i = 2; await db.clonedPage.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  // numa transação: se a criação do job falhar, o clone não fica "pending"
  // travado para sempre, sem job nenhum que o processe
  const clone = await db.$transaction(async (tx) => {
    const clone = await tx.clonedPage.create({
      data: { sourceUrl: alvo.toString(), slug, adId: adId ?? null },
    });
    await tx.job.create({
      data: { kind: "clone", payload: JSON.stringify({ cloneId: clone.id }), priority: 9 },
    });
    return clone;
  });

  return Response.json({ id: clone.id, slug });
}

/** Estado dos clones, para a UI acompanhar. */
export async function GET() {
  const clones = await db.clonedPage.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return Response.json({ clones });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };

  const clone = await db.clonedPage.findUnique({ where: { id } });
  if (clone?.localDir) {
    fs.rmSync(absolute(clone.localDir), { recursive: true, force: true });
  }
  await db.clonedPage.delete({ where: { id } });

  return Response.json({ ok: true });
}
