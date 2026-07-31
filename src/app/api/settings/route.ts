import { db } from "@/lib/db";
import { getMaskedSettings, setSetting, SETTING_DEFS } from "@/lib/settings";

export const runtime = "nodejs";

const EDITABLE = new Set(SETTING_DEFS.map((d) => d.key));

export async function GET() {
  return Response.json({ settings: await getMaskedSettings() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, string>;

  for (const [key, value] of Object.entries(body)) {
    // só aceita chaves que a própria app declara — nada de gravar env arbitrária
    if (!EDITABLE.has(key)) continue;
    await setSetting(key, value.trim());
  }

  // chave nova pode destravar jobs que morreram por falta dela
  await db.job.updateMany({
    where: { status: "failed", kind: { in: ["enrich", "transcribe"] } },
    data: { status: "pending", attempts: 0, error: null, runAfter: new Date() },
  });

  return Response.json({ settings: await getMaskedSettings() });
}
