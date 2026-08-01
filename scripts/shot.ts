/**
 * Screenshot de uma página do app, já autenticado.
 *   npm run shot -- /traqueamento saida.png [--full]
 *
 * Cria uma sessão direto no banco e injeta o cookie, em vez de preencher o
 * formulário: assim a captura não depende de saber a senha.
 */
import { chromium } from "playwright";
import crypto from "node:crypto";
import { db } from "../src/lib/db.js";

const rota = process.argv[2] ?? "/";
const saida = process.argv[3] ?? "shot.png";

const user = await db.user.findFirst();
if (!user) {
  console.error("  Nenhum usuário: o app vai redirecionar para /instalar.");
  process.exit(1);
}

const token = crypto.randomBytes(32).toString("hex");
await db.session.create({
  data: {
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    userId: user.id,
    expiresAt: new Date(Date.now() + 3600_000),
  },
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([
  { name: "scrapper_session", value: token, domain: "localhost", path: "/" },
]);

const page = await ctx.newPage();
await page.goto(`http://localhost:3000${rota}`, { waitUntil: "networkidle" });
await page.screenshot({ path: saida, fullPage: process.argv.includes("--full") });
await browser.close();

// a sessão era só para a captura
await db.session.deleteMany({
  where: { tokenHash: crypto.createHash("sha256").update(token).digest("hex") },
});
await db.$disconnect();

console.log(`  salvo em ${saida}`);
