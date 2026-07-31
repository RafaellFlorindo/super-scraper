import { db } from "@/lib/db";
import { generateCreatives, generateImage } from "@/lib/creative-factory";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "generate" | "image" | "offer";
    projectId?: string;
    sourceCreativeId?: string;
    count?: number;
    generatedId?: string;
    ownerOffer?: string;
  };

  try {
    if (body.action === "offer") {
      await db.project.update({
        where: { id: body.projectId! },
        data: { ownerOffer: body.ownerOffer ?? "" },
      });
      return Response.json({ ok: true });
    }

    if (body.action === "generate") {
      const criados = await generateCreatives({
        projectId: body.projectId!,
        sourceCreativeId: body.sourceCreativeId,
        count: body.count,
      });
      return Response.json({ ok: true, count: criados.length });
    }

    if (body.action === "image") {
      const imagePath = await generateImage(body.generatedId!);
      return Response.json({ ok: true, imagePath });
    }

    return Response.json({ error: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  await db.generatedCreative.delete({ where: { id } });
  return Response.json({ ok: true });
}
