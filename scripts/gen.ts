/** Mostra os criativos gerados no último projeto: npm run gen */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const itens = await db.generatedCreative.findMany({
  orderBy: { createdAt: "desc" },
  take: 3,
  include: { project: true },
});

for (const g of itens) {
  console.log(`\n  [${g.project.title}] ângulo: ${g.angle}`);
  console.log(`  HOOK: ${g.hook}`);
  console.log(`  STORYBOARD: ${g.storyboard ? g.storyboard.slice(0, 700) : "(vazio)"}`);
  console.log(`  IMAGEM: ${g.imagePrompt?.slice(0, 120) ?? "(vazio)"}`);
}
console.log();
await db.$disconnect();
