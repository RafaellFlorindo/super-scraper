/** Smoke test autenticado: todas as rotas principais devem responder 200. */
import "dotenv/config";
import crypto from "node:crypto";
import { db } from "../src/lib/db.js";

const user = await db.user.findFirst();
const token = crypto.randomBytes(32).toString("hex");
await db.session.create({
  data: {
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    userId: user!.id,
    expiresAt: new Date(Date.now() + 3600_000),
  },
});

const ad = await db.ad.findFirst({ orderBy: { scaleScore: "desc" } });
const projeto = await db.project.findFirst();
const tracked = await db.trackedOffer.findFirst();

const rotas = [
  "/", "/historico", "/projetos", "/funis", "/funil-hacking", "/analise-ofertas",
  "/clones", "/traqueamento", "/perfil", "/config",
  ad && `/ads/${ad.id}`,
  projeto && `/projetos/${projeto.id}`,
  tracked && `/analise-ofertas/${tracked.id}`,
].filter(Boolean) as string[];

let falhas = 0;
for (const rota of rotas) {
  const res = await fetch(`http://localhost:3000${rota}`, {
    headers: { cookie: `scrapper_session=${token}` },
    redirect: "manual",
  });
  const ok = res.status === 200;
  if (!ok) falhas++;
  console.log(`${ok ? "✓" : "✗"} ${res.status} ${rota}`);
}
console.log(falhas === 0 ? "\ntudo 200" : `\n${falhas} rota(s) com problema`);
await db.$disconnect();
