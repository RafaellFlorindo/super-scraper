import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Anexa um anúncio minerado a um projeto — vira contexto dos agentes. */
export async function POST(req: Request) {
  const { adId, projectId } = (await req.json()) as { adId: string; projectId: string };

  await db.savedAd.upsert({
    where: { projectId_adId: { projectId, adId } },
    create: { projectId, adId },
    update: {},
  });

  return Response.json({ ok: true });
}
