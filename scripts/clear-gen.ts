/** Apaga os criativos gerados: npm run clear-gen */
import "dotenv/config";
import { db } from "../src/lib/db.js";

const { count } = await db.generatedCreative.deleteMany({});
console.log(`\n  ${count} criativos gerados removidos.\n`);
await db.$disconnect();
