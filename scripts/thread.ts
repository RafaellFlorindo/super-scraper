/** Mostra a última resposta de um agente: npm run thread -- fabrica */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const agent = process.argv[2] ?? "fabrica";
const conv = await db.conversation.findFirst({
  where: { agent },
  orderBy: { createdAt: "desc" },
  include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, project: true },
});

if (!conv?.messages.length) {
  console.log(`\n  Sem conversa para "${agent}".\n`);
} else {
  console.log(`\n  [${conv.project.title}] ${agent}\n`);
  console.log(conv.messages[0].content.slice(0, 2500));
  console.log();
}
await db.$disconnect();
