/** Clica num elemento pelo texto/seletor e tira screenshot: para depurar UI interativa. */
import { chromium } from "playwright";
import crypto from "node:crypto";
import { db } from "../src/lib/db.js";

const [, , rota, seletor, saida] = process.argv;

const user = await db.user.findFirst();
if (!user) throw new Error("sem usuário");
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
await ctx.addCookies([{ name: "scrapper_session", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.goto(`http://localhost:3000${rota}`, { waitUntil: "networkidle" });
await page.click(seletor);
await page.waitForTimeout(400);
await page.screenshot({ path: saida });
await browser.close();
await db.session.deleteMany({
  where: { tokenHash: crypto.createHash("sha256").update(token).digest("hex") },
});
await db.$disconnect();
console.log("salvo em", saida);
