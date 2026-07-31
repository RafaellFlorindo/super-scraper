"use client";

import { useState, useRef, useEffect } from "react";

interface Msg {
  id: string;
  role: string;
  content: string;
}

interface AgentInfo {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  greeting: string;
}

interface Props {
  projectId: string;
  agents: AgentInfo[];
  initial: Record<string, Msg[]>;
  savedCount: number;
  /** Prompt inicial por agente, montado a partir do anúncio modelado. */
  seeds: Record<string, string>;
  modeling: boolean;
}

export default function AgentStudio({
  projectId,
  agents,
  initial,
  savedCount,
  seeds,
  modeling,
}: Props) {
  const [active, setActive] = useState(agents[0].id);
  const [threads, setThreads] = useState(initial);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chainStep, setChainStep] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agent = agents.find((a) => a.id === active)!;
  const messages = threads[active] ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  /** Envia para um agente específico e devolve a resposta completa. */
  async function ask(agentId: string, text: string) {
    const draftId = `draft-${agentId}-${Date.now()}`;
    setThreads((t) => ({
      ...t,
      [agentId]: [
        ...(t[agentId] ?? []),
        { id: `u-${draftId}`, role: "user", content: text },
        { id: draftId, role: "assistant", content: "" },
      ],
    }));

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, agent: agentId, message: text }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setThreads((t) => ({
        ...t,
        [agentId]: (t[agentId] ?? []).map((m) =>
          m.id === draftId ? { ...m, content: acc } : m
        ),
      }));
    }
    return acc;
  }

  async function send(e: React.FormEvent, override?: string) {
    e.preventDefault();
    const text = (override ?? input).trim();
    if (!text || streaming) return;

    setInput("");
    setStreaming(true);
    try {
      await ask(active, text);
    } finally {
      setStreaming(false);
    }
  }

  /**
   * Roda os três em ordem. Cada um lê no contexto o que o anterior entregou,
   * então o Lapidador já recebe a estrutura do Optimus e a Fábrica recebe as
   * duas coisas, sem o usuário repetir nada.
   */
  async function runChain() {
    if (streaming) return;
    setStreaming(true);
    try {
      for (const a of agents) {
        setActive(a.id);
        setChainStep(a.name);
        await ask(a.id, seeds[a.id]);
      }
    } finally {
      setChainStep(null);
      setStreaming(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {modeling && (
          <button
            onClick={runChain}
            disabled={streaming}
            className="w-full rounded-xl bg-gold-500 px-3 py-3 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:opacity-50"
          >
            {chainStep ? `Rodando ${chainStep}...` : "Rodar os 3 em sequência"}
          </button>
        )}

        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setActive(a.id)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              a.id === active
                ? "border-gold-500/40 bg-gold-500/10"
                : "border-white/5 bg-ink-800 hover:border-white/10"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <span>{a.icon}</span> {a.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-zinc-500">{a.tagline}</div>
          </button>
        ))}

        <div className="rounded-xl border border-white/5 bg-ink-800 p-3 text-xs text-zinc-500">
          {savedCount > 0 ? (
            <>
              <span className="text-gold-400">{savedCount}</span> anúncio(s) de referência
              alimentando os agentes.
            </>
          ) : (
            <>
              Nenhum anúncio anexado. Abra um anúncio no banco e clique em
              <span className="text-zinc-300"> Usar como referência</span> para os agentes
              trabalharem com dados reais do nicho.
            </>
          )}
        </div>
      </div>

      <div className="flex h-[calc(100vh-220px)] flex-col rounded-xl border border-white/5 bg-ink-800">
        <div className="border-b border-white/5 px-5 py-3">
          <div className="text-sm font-medium text-zinc-100">
            {agent.icon} {agent.name}
          </div>
          <div className="text-xs text-zinc-500">{agent.tagline}</div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-ink-700/50 p-4 text-sm text-zinc-400">
                {modeling
                  ? "Já estou com o anúncio modelado em mãos: copy, transcrição da VSL, preço e ângulo do concorrente. É só mandar."
                  : agent.greeting}
              </div>
              {modeling && seeds[active] && (
                <button
                  onClick={(e) => send(e, seeds[active])}
                  disabled={streaming}
                  className="w-full rounded-xl border border-gold-500/30 bg-gold-500/10 p-4 text-left text-sm text-gold-300 transition hover:bg-gold-500/15 disabled:opacity-40"
                >
                  <span className="mb-1 block text-[11px] uppercase tracking-wide text-gold-500/70">
                    Começar direto
                  </span>
                  {seeds[active]}
                </button>
              )}
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold-500/15 text-zinc-100"
                    : "bg-ink-700/60 text-zinc-200"
                }`}
              >
                {m.content || <span className="text-zinc-500">escrevendo...</span>}
                {m.role === "assistant" && m.content && (
                  <button
                    onClick={() => navigator.clipboard.writeText(m.content)}
                    className="mt-3 block text-xs text-zinc-500 hover:text-gold-400"
                  >
                    Copiar
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-white/5 p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            rows={2}
            placeholder={`Falar com ${agent.name}...  (Enter envia, Shift+Enter quebra linha)`}
            className="flex-1 resize-none rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50"
          />
          <button
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-gold-500 px-5 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:opacity-40"
          >
            {streaming ? "..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}
