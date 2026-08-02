import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Enfileira a re-coleta de UM anúncio agora. Quem executa é o worker. */
export async function POST(req: Request) {
  const { adId } = (await req.json()) as { adId: string };

  const ad = await db.ad.findUnique({ where: { id: adId }, select: { id: true } });
  if (!ad) return Response.json({ error: "anúncio não encontrado" }, { status: 404 });

  const jaNaFila = await db.job.findFirst({
    where: { kind: "refreshad", status: { in: ["pending", "running"] }, payload: { contains: adId } },
  });
  if (jaNaFila) return Response.json({ jobId: jaNaFila.id, jaExistia: true });

  const job = await db.job.create({
    data: { kind: "refreshad", payload: JSON.stringify({ adId }), priority: 9 },
  });
  return Response.json({ jobId: job.id });
}

/** Estado do job, para a UI saber quando o snapshot novo chegou. */
export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "informe jobId" }, { status: 400 });
  const job = await db.job.findUnique({ where: { id: jobId }, select: { status: true, error: true } });
  return Response.json({ status: job?.status ?? "done", error: job?.error ?? null });
}
