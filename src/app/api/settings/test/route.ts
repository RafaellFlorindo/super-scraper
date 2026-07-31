import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";

/**
 * Faz uma chamada real ao provider para dizer se a chave funciona de verdade.
 * Chave sintaticamente válida mas sem cota é o erro mais comum aqui — daí testar
 * de verdade em vez de só conferir se o campo está preenchido.
 */
export async function POST(req: Request) {
  const { provider } = (await req.json()) as { provider: string };

  try {
    if (provider === "gemini") {
      const key = await getSetting("GEMINI_API_KEY");
      if (!key) return Response.json({ ok: false, message: "Chave não preenchida" });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ok" }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );
      if (res.ok) return Response.json({ ok: true, message: "Funcionando" });
      if (res.status === 429)
        return Response.json({ ok: false, message: "Chave válida, mas a cota do dia acabou" });
      return Response.json({ ok: false, message: `Erro ${res.status}` });
    }

    if (provider === "groq") {
      const key = await getSetting("GROQ_API_KEY");
      if (!key) return Response.json({ ok: false, message: "Chave não preenchida" });
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { authorization: `Bearer ${key}` },
      });
      return Response.json(
        res.ok
          ? { ok: true, message: "Funcionando" }
          : { ok: false, message: `Erro ${res.status}` }
      );
    }

    if (provider === "anthropic") {
      const key = await getSetting("ANTHROPIC_API_KEY");
      if (!key) return Response.json({ ok: false, message: "Chave não preenchida" });
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 5,
          messages: [{ role: "user", content: "ok" }],
        }),
      });
      return Response.json(
        res.ok
          ? { ok: true, message: "Funcionando" }
          : { ok: false, message: `Erro ${res.status}` }
      );
    }

    return Response.json({ ok: false, message: "Provider desconhecido" });
  } catch (e) {
    return Response.json({ ok: false, message: (e as Error).message.slice(0, 120) });
  }
}
