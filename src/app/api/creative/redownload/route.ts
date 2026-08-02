import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Enfileira o reparo de mídia de um anúncio: rebusca URLs frescas na Ad
 * Library e tenta baixar de novo os criativos que ficaram sem arquivo.
 */
export async function POST(req: Request) {
  const { adId } = (await req.json()) as { adId: string };
  if (!adId) return Response.json({ error: "informe adId" }, { status: 400 });

  await db.job.create({
    data: { kind: "redownload", payload: JSON.stringify({ adId }), priority: 9 },
  });

  return Response.json({ ok: true });
}
