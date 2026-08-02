import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Marca uma oferta (anúncio) para acompanhamento na Análise de Ofertas. */
export async function POST(req: Request) {
  const { adId } = (await req.json()) as { adId: string };
  const ad = await db.ad.findUnique({ where: { id: adId }, select: { id: true } });
  if (!ad) return Response.json({ error: "anúncio não encontrado" }, { status: 404 });

  const tracked = await db.trackedOffer.upsert({
    where: { adId },
    create: { adId },
    update: {},
  });
  return Response.json({ id: tracked.id });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id: string };
  await db.trackedOffer.delete({ where: { id } }).catch(() => {});
  return Response.json({ ok: true });
}
