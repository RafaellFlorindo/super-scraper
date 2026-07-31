import { db } from "@/lib/db";
import { normalize } from "@/lib/checkout";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";

/**
 * Recebe o webhook da plataforma de checkout.
 *
 * URL: /api/webhook/kiwify?token=SEU_TOKEN
 *
 * O token vem das Configurações e existe porque este endpoint é público — sem
 * ele, qualquer um poderia injetar vendas falsas no seu dashboard.
 *
 * Stateless de propósito: é a parte que vai para a Vercel quando você hospedar.
 */
export async function POST(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-webhook-token") ?? "";

  const expected = await getSetting("WEBHOOK_TOKEN");
  if (!expected || token !== expected) {
    return Response.json({ error: "token inválido" }, { status: 401 });
  }

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // algumas plataformas mandam form-urlencoded
    body = Object.fromEntries(new URLSearchParams(rawBody));
  }

  try {
    const sale = normalize(platform, body);

    // upsert por (plataforma, id, status): a mesma venda chega várias vezes
    // conforme muda de estado, e cada estado vira uma linha própria — é isso
    // que permite ver reembolso sem perder a venda original.
    await db.sale.upsert({
      where: {
        platform_externalId_status: {
          platform: sale.platform,
          externalId: sale.externalId,
          status: sale.status,
        },
      },
      create: { ...sale, rawJson: rawBody.slice(0, 100_000) },
      update: { amountCents: sale.amountCents, occurredAt: sale.occurredAt },
    });

    await db.webhookEvent.create({
      data: { platform, ok: true, bodyJson: rawBody.slice(0, 20_000) },
    });

    return Response.json({ ok: true });
  } catch (e) {
    // 200 mesmo em erro: se devolvermos 500, a plataforma reenvia em loop.
    // O evento fica gravado e você reprocessa depois.
    await db.webhookEvent.create({
      data: {
        platform,
        ok: false,
        error: (e as Error).message.slice(0, 500),
        bodyJson: rawBody.slice(0, 20_000),
      },
    });
    return Response.json({ ok: false, error: "registrado para revisão" });
  }
}

/** GET serve para a plataforma validar a URL na hora de cadastrar. */
export async function GET() {
  return Response.json({ ok: true, message: "endpoint de webhook ativo" });
}
