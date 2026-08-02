/**
 * Dispara webhooks de teste contra o app rodando.
 *   npm run fake-sale
 *
 * Usa payloads no formato real da Kiwify e da Cakto, com UTM, para validar a
 * atribuição de ponta a ponta antes de plugar a plataforma de verdade.
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";
import { getSetting } from "../src/lib/settings.js";

const base = process.env.APP_URL ?? "http://localhost:3000";
const token = await getSetting("WEBHOOK_TOKEN");

if (!token) {
  console.error("\n  Sem WEBHOOK_TOKEN. Gere em Configurações no app.\n");
  process.exit(1);
}

const payloads: { platform: string; body: unknown }[] = [
  {
    platform: "kiwify",
    body: {
      order_id: "kw_test_0001",
      order_status: "paid",
      webhook_event_type: "order_approved",
      Product: { product_name: "Bolos Caseiros Saudáveis" },
      Customer: { email: "ana.silva@gmail.com", full_name: "Ana Silva" },
      Commissions: { charge_amount: 9700, currency: "BRL" },
      payment_method: "pix",
      TrackingParameters: {
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: "bolos-frio-01",
        utm_content: "vsl-depoimento-a",
      },
      created_at: new Date().toISOString(),
    },
  },
  {
    platform: "kiwify",
    body: {
      order_id: "kw_test_0002",
      order_status: "paid",
      Product: { product_name: "Bolos Caseiros Saudáveis" },
      Customer: { email: "jo.pereira@hotmail.com" },
      Commissions: { charge_amount: 9700, currency: "BRL" },
      payment_method: "credit_card",
      TrackingParameters: {
        utm_source: "facebook",
        utm_campaign: "bolos-frio-01",
        utm_content: "estatico-antes-depois",
      },
      created_at: new Date().toISOString(),
    },
  },
  {
    platform: "kiwify",
    body: {
      // mesma venda da primeira, agora reembolsada
      order_id: "kw_test_0001",
      order_status: "refunded",
      Product: { product_name: "Bolos Caseiros Saudáveis" },
      Customer: { email: "ana.silva@gmail.com" },
      Commissions: { charge_amount: 9700, currency: "BRL" },
      TrackingParameters: { utm_campaign: "bolos-frio-01", utm_content: "vsl-depoimento-a" },
      created_at: new Date().toISOString(),
    },
  },
  {
    platform: "cakto",
    body: {
      event: "purchase_approved",
      data: {
        id: "ck_test_9001",
        status: "paid",
        amount: 197.0, // Cakto manda em reais, não centavos
        payment_method: "boleto",
        product: { name: "Curso Molde F1" },
        customer: { email: "carla@uol.com.br" },
        // aqui o UTM vem numa query string só, como algumas plataformas fazem
        src: "https://pay.cakto.com.br/x?utm_source=facebook&utm_campaign=molde-escala&utm_content=ugc-01",
        paid_at: new Date().toISOString(),
      },
    },
  },
  {
    // formato v2.0.0: status vem no campo "event", preço em reais
    platform: "hotmart",
    body: {
      event: "PURCHASE_APPROVED",
      version: "2.0.0",
      creation_date: Date.now(),
      data: {
        product: { name: "Fórmula do Emagrecimento" },
        buyer: { email: "juliana@hotmail.com" },
        purchase: {
          transaction: "HP" + Date.now(),
          price: { value: 297, currency_value: "BRL" },
          payment: { type: "BILLET" },
          approved_date: Date.now(),
          origin: {
            utm_source: "facebook",
            utm_campaign: "emagrece-jejum",
            utm_content: "vsl-hotmart-a",
          },
        },
      },
    },
  },
  {
    // total_price vem formatado como string, não em centavos
    platform: "kirvano",
    body: {
      event: "SALE_APPROVED",
      sale_id: "kv_test_" + Date.now(),
      status: "APPROVED",
      total_price: "R$ 169,80",
      payment_method: "PIX",
      products: [{ name: "Mentoria Trade Iniciante" }],
      customer: { email: "roberto@gmail.com" },
      created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      utm: {
        utm_source: "facebook",
        utm_campaign: "trade-vps",
        utm_content: "estatico-01",
      },
    },
  },
];

console.log(`\n  Enviando ${payloads.length} webhooks para ${base}...\n`);

for (const { platform, body } of payloads) {
  const res = await fetch(`${base}/api/webhook/${platform}?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`  ${res.status} ${platform.padEnd(7)} ${JSON.stringify(json)}`);
}

// confere que o token inválido é mesmo recusado
const bad = await fetch(`${base}/api/webhook/kiwify?token=errado`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
console.log(`\n  token inválido → ${bad.status} (esperado 401)`);

const sales = await db.sale.findMany({ orderBy: { createdAt: "desc" }, take: 6 });
console.log("\n  VENDAS NO BANCO");
for (const s of sales) {
  console.log(
    `  ${s.platform.padEnd(7)} ${s.status.padEnd(9)} ` +
      `R$ ${(s.amountCents / 100).toFixed(2).padStart(8)}  ` +
      `${(s.utmCampaign ?? "—").padEnd(18)} ${s.utmContent ?? "—"}  ${s.buyerMasked ?? ""}`
  );
}
console.log();
await db.$disconnect();
