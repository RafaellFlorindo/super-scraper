/** Cria um token de sessão válido para testar via curl. */
import "dotenv/config";
import crypto from "node:crypto";
import { db } from "../src/lib/db.js";

const user = await db.user.findFirst();
if (!user) {
  console.error("Nenhum usuário no banco.");
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
console.log(token);
await db.$disconnect();
