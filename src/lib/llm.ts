/**
 * Adapter de LLM. Padrão = Gemini free tier (sem cartão, cota diária boa).
 * Trocar de provider é mudar LLM_PROVIDER no .env — nada mais no código.
 */
import { getSetting } from "./settings";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = "gemini" | "groq" | "anthropic";

// gemini-flash-latest em vez de gemini-2.0-flash: as versões numeradas retornam
// 429 com "limit: 0" em contas sem cota free para aquele modelo específico.
// Rode `npm run probe` para conferir o que a sua chave libera.
const MODELS: Record<Provider, string> = {
  gemini: "gemini-flash-latest",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-sonnet-5",
};

/**
 * Free tier do Gemini gira em torno de 15 req/min. O worker processa jobs em
 * sequência sem pausa, o que estoura o limite em segundos — daí o espaçamento
 * mínimo entre chamadas.
 */
const MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS || 4500);
let lastCall = 0;

async function throttle() {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

const KEY_FOR: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

async function provider(): Promise<Provider> {
  return ((await getSetting("LLM_PROVIDER")) as Provider) || "gemini";
}

/** Chave do provider ativo, vinda da tela de Configurações ou do .env. */
async function apiKey(p: Provider): Promise<string> {
  return getSetting(KEY_FOR[p]);
}

export async function llmConfigured(): Promise<boolean> {
  return Boolean(await apiKey(await provider()));
}

/** Retorna o texto completo. Para streaming na UI, use `streamChat`. */
export async function chat(messages: ChatMessage[], opts: { json?: boolean } = {}): Promise<string> {
  let out = "";
  for await (const chunk of streamChat(messages, opts)) out += chunk;
  return out;
}

export async function* streamChat(
  messages: ChatMessage[],
  opts: { json?: boolean } = {}
): AsyncGenerator<string> {
  const p = await provider();
  const key = await apiKey(p);
  if (!key) {
    throw new Error(
      `Sem chave de API para "${p}". Adicione em Configurações no app (todas têm plano grátis).`
    );
  }
  await throttle();
  switch (p) {
    case "gemini":
      yield* geminiStream(key, messages, opts);
      return;
    case "groq":
    case "anthropic":
      yield* openAIish(p, key, messages, opts);
      return;
  }
}

async function* geminiStream(key: string, messages: ChatMessage[], opts: { json?: boolean }) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:streamGenerateContent` +
    `?alt=sse&key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 8192,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  for await (const data of sse(res)) {
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) yield text as string;
  }
}

/** Groq e Anthropic falam dialetos próximos o bastante para compartilhar código. */
async function* openAIish(
  p: "groq" | "anthropic",
  key: string,
  messages: ChatMessage[],
  opts: { json?: boolean }
) {
  const isAnthropic = p === "anthropic";
  const url = isAnthropic
    ? "https://api.anthropic.com/v1/messages"
    : "https://api.groq.com/openai/v1/chat/completions";

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (isAnthropic) {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.authorization = `Bearer ${key}`;
  }

  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");

  const body = isAnthropic
    ? { model: MODELS.anthropic, max_tokens: 8192, stream: true, system, messages: rest }
    : {
        model: MODELS.groq,
        stream: true,
        messages,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      };

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${p} ${res.status}: ${await res.text()}`);

  for await (const data of sse(res)) {
    const text = isAnthropic
      ? data?.delta?.text
      : data?.choices?.[0]?.delta?.content;
    if (text) yield text as string;
  }
}

/** Parser de Server-Sent Events comum aos três providers. */
async function* sse(res: Response): AsyncGenerator<any> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload);
      } catch {
        /* fragmento parcial: ignora */
      }
    }
  }
}
