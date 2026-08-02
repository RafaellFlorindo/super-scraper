import "dotenv/config";
import { checkDeps, ffmpegPath } from "../src/lib/video.js";
const d = await checkDeps();
console.log("ffmpeg path:", ffmpegPath());
console.log("deps ok:", d.ok, d.missing);
