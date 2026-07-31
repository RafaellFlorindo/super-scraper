/** Descobre quais modelos Gemini a sua chave consegue chamar: npm run probe */
import "dotenv/config";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Sem GEMINI_API_KEY no .env");
  process.exit(1);
}

const list = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
if (!list.ok) {
  console.error(`Falha ao listar modelos: ${list.status} ${await list.text()}`);
  process.exit(1);
}

const { models } = (await list.json()) as { models: { name: string; supportedGenerationMethods?: string[] }[] };
const candidates = models
  .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
  .map((m) => m.name.replace("models/", ""))
  .filter((n) => /flash|pro/.test(n) && !/embedding|vision|tts|image|live|native/.test(n))
  .slice(0, 14);

console.log(`\n  ${candidates.length} modelos candidatos. Testando uma chamada real em cada...\n`);

for (const model of candidates) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "diga ok" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    }
  );
  console.log(`  ${res.ok ? "✓" : "✗"} ${model.padEnd(38)} ${res.status}`);
}
console.log();
