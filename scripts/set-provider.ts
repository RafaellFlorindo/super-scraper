import "dotenv/config";
import { setSetting } from "../src/lib/settings.js";
await setSetting("LLM_PROVIDER", process.argv[2]);
console.log("provider:", process.argv[2]);
