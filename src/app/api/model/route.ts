import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Transforma um anúncio minerado em projeto de modelagem.
 *
 * Cria o projeto, anexa o anúncio como referência e marca como o anúncio
 * modelado. A partir daí os três agentes já abrem sabendo qual oferta estão
 * atacando, sem o usuário digitar nada.
 *
 * Idempotente: modelar duas vezes o mesmo anúncio devolve o projeto existente.
 */
export async function POST(req: Request) {
  const { adId } = (await req.json()) as { adId: string };

  const ad = await db.ad.findUnique({
    where: { id: adId },
    include: { advertiser: true },
  });
  if (!ad) return Response.json({ error: "Anúncio não encontrado" }, { status: 404 });

  const existente = await db.project.findFirst({ where: { modeledAdId: adId } });
  if (existente) return Response.json({ projectId: existente.id, reused: true });

  const titulo =
    (ad.niche ? `${ad.niche} · ` : "") +
    (ad.headline?.slice(0, 45) || ad.advertiser.name.slice(0, 45));

  const project = await db.project.create({
    data: {
      title: titulo,
      modeledAdId: adId,
      savedAds: { create: { adId, note: "anúncio modelado" } },
    },
  });

  return Response.json({ projectId: project.id, reused: false });
}
