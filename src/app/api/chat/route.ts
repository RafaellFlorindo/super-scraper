import { db } from "@/lib/db";
import { AGENTS, buildAdContext, buildModelBrief, buildHandoff, type AgentId } from "@/lib/agents";
import { streamChat, type ChatMessage } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { projectId, agent, message } = (await req.json()) as {
    projectId: string;
    agent: AgentId;
    message: string;
  };

  const def = AGENTS[agent];
  if (!def) return new Response("Agente desconhecido", { status: 400 });

  const conversation = await db.conversation.upsert({
    where: { projectId_agent: { projectId, agent } },
    create: { projectId, agent },
    update: {},
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  await db.message.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  // briefing primeiro: é o anúncio que o usuário escolheu modelar, e vale mais
  // que as referências soltas anexadas depois
  const [brief, handoff, adContext] = await Promise.all([
    buildModelBrief(projectId),
    buildHandoff(projectId, agent),
    buildAdContext(projectId),
  ]);

  const history: ChatMessage[] = [
    { role: "system", content: def.system + brief + handoff + adContext },
    ...conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of streamChat(history)) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        const msg = `\n\n[erro: ${(e as Error).message}]`;
        full += msg;
        controller.enqueue(encoder.encode(msg));
      }
      // grava a resposta só no fim: se o stream cair, não fica meia mensagem
      await db.message.create({
        data: { conversationId: conversation.id, role: "assistant", content: full },
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" },
  });
}
