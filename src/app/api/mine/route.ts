import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Enfileira uma mineração. Quem executa é o worker (`npm run worker`), que já
 * está rodando — assim nada de janela de console piscando nem processo órfão.
 */
export async function POST(req: Request) {
  const { query, country = "BR", limit = 40 } = (await req.json()) as {
    query: string;
    country?: string;
    limit?: number;
  };

  if (!query?.trim()) return Response.json({ error: "Informe o nicho" }, { status: 400 });

  const active = await db.miningRun.findFirst({ where: { status: "running" } });
  if (active) {
    return Response.json(
      { error: `Já existe uma mineração rodando ("${active.query}"). Aguarde terminar.` },
      { status: 409 }
    );
  }

  const run = await db.miningRun.create({ data: { query, country, limit } });
  await db.job.create({
    data: { kind: "mine", payload: JSON.stringify({ runId: run.id }), priority: 10 },
  });

  return Response.json({ runId: run.id });
}

/** Estado da mineração atual e do worker, para a UI acompanhar. */
export async function GET() {
  const [run, beat] = await Promise.all([
    db.miningRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.workerHeartbeat.findUnique({ where: { id: "singleton" } }),
  ]);

  // o worker bate a cada ~2s; 15s de silêncio significa que ele caiu ou nunca subiu
  const workerOnline = Boolean(beat && Date.now() - beat.beatAt.getTime() < 15_000);

  return Response.json({ run, workerOnline });
}
