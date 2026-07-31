/** Mostra as conversas salvas: npm run threads */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const convs = await db.conversation.findMany({
  include: { project: true, messages: { orderBy: { createdAt: "asc" } } },
});

for (const c of convs) {
  console.log(`\n  [${c.project.title}] ${c.agent} — ${c.messages.length} mensagens`);
  for (const m of c.messages) {
    console.log(`    ${m.role.padEnd(9)} ${m.content.length} chars`);
  }
}
console.log();
await db.$disconnect();
