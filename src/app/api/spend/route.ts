import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Aceita "250", "250,00" e "R$ 1.250,50". */
function toCents(input: string): number {
  const clean = String(input).replace(/[^\d.,-]/g, "");
  if (!clean) return NaN;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export async function POST(req: Request) {
  const { utmCampaign, day, amount } = (await req.json()) as {
    utmCampaign: string;
    day: string;
    amount: string;
  };

  const cents = toCents(amount);
  if (!utmCampaign?.trim()) return Response.json({ error: "Informe a campanha" }, { status: 400 });
  if (!Number.isFinite(cents) || cents < 0)
    return Response.json({ error: "Valor inválido" }, { status: 400 });

  // meia-noite UTC: a chave única é (campanha, dia), então a hora precisa ser fixa
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()))
    return Response.json({ error: "Data inválida" }, { status: 400 });

  await db.adSpend.upsert({
    where: { utmCampaign_day: { utmCampaign: utmCampaign.trim(), day: date } },
    create: { utmCampaign: utmCampaign.trim(), day: date, amountCents: cents },
    update: { amountCents: cents },
  });

  return Response.json({ ok: true });
}
