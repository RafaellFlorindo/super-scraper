import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Reanalisa os funis agora, em vez de esperar a próxima passagem natural do
 * worker. Reenfileira com prioridade de ação direta do usuário (9), então
 * fura na frente do resto da fila.
 *
 * Limitado a 50 por chamada: o worker processa um funil por vez (abre
 * browser, ~15s cada), então pedir "atualizar tudo" de uma vez só faria a fila
 * demorar minutos sem dar nenhum feedback intermediário.
 */
const LIMITE = 50;

export async function POST(req: Request) {
  const { minScore } = (await req.json().catch(() => ({}))) as { minScore?: number };

  const ads = await db.ad.findMany({
    where: {
      ctaUrl: { not: null },
      ...(minScore ? { scaleScore: { gte: minScore } } : {}),
    },
    orderBy: { scaleScore: "desc" },
    take: LIMITE,
    select: { id: true },
  });

  // não duplica se já tiver um job de funil pendente para o mesmo anúncio
  const jaNaFila = new Set(
    (
      await db.job.findMany({
        where: { kind: "funnel", status: { in: ["pending", "running"] } },
        select: { payload: true },
      })
    ).map((j) => JSON.parse(j.payload).adId as string)
  );

  let criados = 0;
  for (const ad of ads) {
    if (jaNaFila.has(ad.id)) continue;
    await db.job.create({
      data: { kind: "funnel", payload: JSON.stringify({ adId: ad.id }), priority: 9 },
    });
    criados++;
  }

  return Response.json({ ok: true, criados, total: ads.length });
}
