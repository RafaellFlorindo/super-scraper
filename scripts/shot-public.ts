/** Screenshot sem autenticação (para /login). */
import { chromium } from "playwright";
const rota = process.argv[2] ?? "/login";
const saida = process.argv[3] ?? "shot.png";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`http://localhost:3000${rota}`, { waitUntil: "networkidle" });
await page.screenshot({ path: saida });
await browser.close();
console.log(`salvo em ${saida}`);
