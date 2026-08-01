/**
 * Confere que a página hospedada abre e que os rastreadores do concorrente
 * não sobreviveram ao clone: npm run test-clone
 */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const clone = await db.clonedPage.findFirst({
  where: { status: "done" },
  orderBy: { createdAt: "desc" },
});
if (!clone) {
  console.log("\n  Nenhum clone pronto.\n");
  process.exit(0);
}

const url = `http://localhost:3000/p/${clone.slug}`;
const res = await fetch(url);
const html = await res.text();

console.log(`\n  ${url}`);
console.log(`  status: ${res.status} · ${(html.length / 1024).toFixed(0)} KB`);
console.log(`  robots: ${res.headers.get("x-robots-tag")}`);

const VAZAMENTOS = [
  "connect.facebook.net",
  "facebook.com/tr",
  "googletagmanager.com",
  "google-analytics.com",
  "fbq(",
  "gtag(",
  "hotjar",
  "clarity.ms",
];

console.log("\n  RASTREADORES NO HTML SERVIDO");
let sujo = 0;
for (const t of VAZAMENTOS) {
  const achou = html.toLowerCase().includes(t.toLowerCase());
  if (achou) sujo++;
  console.log(`  ${achou ? "✗ AINDA PRESENTE" : "✓ removido      "} ${t}`);
}

// checkouts do concorrente não podem continuar clicáveis
const checkoutVivo = /href="https?:\/\/[^"]*(hotmart|kiwify|eduzz|monetizze|cakto)/i.test(html);
console.log(`\n  ${checkoutVivo ? "✗" : "✓"} links de checkout do concorrente ${checkoutVivo ? "AINDA ATIVOS" : "neutralizados"}`);

const marcados = (html.match(/data-checkout-original/g) ?? []).length;
console.log(`  ${marcados} link(s) de compra marcados para você trocar`);

console.log(`\n  ${sujo === 0 && !checkoutVivo ? "Clone limpo." : "Revisar: sobrou coisa do concorrente."}\n`);
await db.$disconnect();
