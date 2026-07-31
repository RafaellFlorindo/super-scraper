import fs from "node:fs";
import { db } from "@/lib/db";
import { absolute } from "@/lib/storage";

export const runtime = "nodejs";

// não exportado: rotas do Next só aceitam exportar handlers e config
const STATUSES = ["rascunho", "ativo", "concluido"] as const;

/** Troca o status do projeto. */
export async function PATCH(req: Request) {
  const { id, status, title } = (await req.json()) as {
    id: string;
    status?: string;
    title?: string;
  };

  if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return Response.json({ error: "status inválido" }, { status: 400 });
  }

  await db.project.update({
    where: { id },
    data: { ...(status ? { status } : {}), ...(title ? { title } : {}) },
  });
  return Response.json({ ok: true });
}

/**
 * Apaga o projeto.
 *
 * Leva junto conversas, criativos gerados e as referências anexadas (cascata do
 * schema). NÃO apaga os anúncios minerados: eles são do banco de anúncios e
 * podem estar em outros projetos.
 */
export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };

  // imagens geradas ficam em disco e não somem sozinhas com o registro
  const gerados = await db.generatedCreative.findMany({
    where: { projectId: id, imagePath: { not: null } },
    select: { imagePath: true },
  });
  for (const g of gerados) {
    try {
      fs.rmSync(absolute(g.imagePath!), { force: true });
    } catch {
      /* arquivo já não existe */
    }
  }

  await db.project.delete({ where: { id } });
  return Response.json({ ok: true });
}
