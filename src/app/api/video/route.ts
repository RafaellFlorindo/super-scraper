import { db } from "@/lib/db";
import { planScenes, checkDeps, VOICES } from "@/lib/video";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Enfileira a geração do vídeo de um criativo gerado. */
export async function POST(req: Request) {
  const { generatedCreativeId, voice, engine } = (await req.json()) as {
    generatedCreativeId: string;
    voice?: string;
    engine?: "montagem" | "higgsfield";
  };

  // Higgsfield: sem ffmpeg, sem narração — só a imagem gerada + a API externa
  if (engine === "higgsfield") {
    const creative = await db.generatedCreative.findUnique({
      where: { id: generatedCreativeId },
      select: { imagePath: true },
    });
    if (!creative?.imagePath) {
      return Response.json(
        { error: "Gere a imagem do criativo antes de animar com o Higgsfield." },
        { status: 400 }
      );
    }
    const { getSetting } = await import("@/lib/settings");
    if (!(await getSetting("HIGGSFIELD_API_KEY"))) {
      return Response.json(
        { error: "Configure a Higgsfield API Key em Configurações." },
        { status: 400 }
      );
    }

    const render = await db.videoRender.create({
      data: { generatedCreativeId, engine: "higgsfield" },
    });
    await db.job.create({
      data: { kind: "hfvideo", payload: JSON.stringify({ renderId: render.id }), priority: 9 },
    });
    return Response.json({ renderId: render.id });
  }

  const deps = await checkDeps();
  if (!deps.ok) {
    return Response.json(
      { error: `Faltam dependências no servidor: ${deps.missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // planeja aqui, e não no worker, para o erro de roteiro aparecer na hora
    const scenes = await planScenes(generatedCreativeId);

    const render = await db.videoRender.create({
      data: {
        generatedCreativeId,
        voice: VOICES.some((v) => v.id === voice) ? voice! : VOICES[0].id,
        scenesJson: JSON.stringify(scenes),
      },
    });

    await db.job.create({
      data: { kind: "video", payload: JSON.stringify({ renderId: render.id }), priority: 9 },
    });

    return Response.json({ renderId: render.id, scenes: scenes.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Estado dos renders de um criativo, para a UI acompanhar. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("creativeId");
  if (!id) return Response.json({ error: "informe creativeId" }, { status: 400 });

  const renders = await db.videoRender.findMany({
    where: { generatedCreativeId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ renders });
}
