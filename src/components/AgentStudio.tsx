"use client";

import { useState, useRef, useEffect } from "react";
import { card, campoInset } from "@/lib/ui";

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
  /**
   * A Fábrica de Criativos, renderizada logo abaixo do chat dela. Ficava numa
   * aba própria, separada dos outros dois agentes, o que não fazia sentido:
   * "gerar criativos" é o que ESTE agente faz, não um destino à parte.
   */
  factoryPanel?: React.ReactNode;
}

export default function AgentStudio({
  projectId,
  agents,
  initial,
  savedCount,
  seeds,
  modeling,
  factoryPanel,
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
            className="w-full rounded-xl bg-gold-500 px-3 py-3 text-sm font-medium text-ink-900 transition duration-200 ease-spring hover:bg-gold-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {chainStep ? `Rodando ${chainStep}...` : "Rodar os 3 em sequência"}
          </button>
        )}

        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setActive(a.id)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition duration-200 ease-spring active:scale-[0.98] ${
              a.id === active
                ? "border-gold-500/40 bg-gradient-to-r from-gold-500/15 to-transparent ring-1 ring-gold-500/20"
                : "border-white/5 bg-ink-800 hover:border-white/15 hover:bg-ink-700/60"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition duration-200 ease-spring ${
                a.id === active ? "bg-gold-500 text-ink-900" : "bg-white/5"
              }`}
            >
              {a.icon}
            </span>
            <div className="min-w-0">
              <div
                className={`truncate text-sm font-semibold ${
                  a.id === active ? "text-gold-300" : "text-zinc-100"
                }`}
              >
                {a.name}
              </div>
              <div className="truncate text-xs text-zinc-500">{a.tagline}</div>
            </div>
          </button>
        ))}

        <div className={`${card} p-3 text-xs text-zinc-500`}>
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

      <div className={active === "fabrica" ? "space-y-5" : "contents"}>
      <div
        className={`flex flex-col ${card} ${
          active === "fabrica" ? "h-[480px]" : "h-[calc(100vh-220px)]"
        }`}
      >
        <div className="border-b border-white/5 px-5 py-3">
          <div className="text-sm font-medium text-zinc-100">
            {agent.icon} {agent.name}
          </div>
          <div className="text-xs text-zinc-500">{agent.tagline}</div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-ink-700/50 p-4 text-sm text-zinc-400">
                {modeling
                  ? "Já estou com o anúncio modelado em mãos: copy, transcrição da VSL, preço e ângulo do concorrente. É só mandar."
                  : agent.greeting}
              </div>
              {modeling && seeds[active] && (
                <button
                  onClick={(e) => send(e, seeds[active])}
                  disabled={streaming}
                  className="w-full rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4 text-left text-sm text-gold-300 transition duration-200 ease-spring hover:bg-gold-500/15 active:scale-[0.99] disabled:opacity-40"
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
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold-500/15 text-zinc-100"
                    : "bg-ink-700/60 text-zinc-200"
                }`}
              >
                {m.content || <span className="text-zinc-500">escrevendo...</span>}
                {m.role === "assistant" && m.content && (
                  <button
                    onClick={() => navigator.clipboard.writeText(m.content)}
                    className="mt-3 block text-xs text-zinc-500 transition duration-200 ease-spring hover:text-gold-400"
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
            className={`flex-1 resize-none !h-auto py-2 ${campoInset} placeholder:text-zinc-600`}
          />
          <button
            disabled={streaming || !input.trim()}
            className="rounded-xl bg-gold-500 px-5 text-sm font-medium text-ink-900 transition duration-200 ease-spring hover:bg-gold-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            {streaming ? "..." : "Enviar"}
          </button>
        </form>
      </div>

      {active === "fabrica" && factoryPanel}
      </div>
    </div>
  );
}
