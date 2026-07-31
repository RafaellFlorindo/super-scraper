/** Mostra os erros de um tipo de job: npm run errors -- funnel */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const kind = process.argv[2];
const jobs = await db.job.findMany({
  where: { status: "failed", ...(kind ? { kind } : {}) },
  take: 10,
});
for (const j of jobs) console.log(`  ${j.kind}: ${j.error}`);
console.log(`\n  ${jobs.length} mostrados.\n`);
await db.$disconnect();
