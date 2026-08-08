"use client";

import { useState } from "react";
import { card, campoInset, pill, btnPrimary, btnSecondary } from "@/lib/ui";

interface Item {
  key: string;
  label: string;
  help: string;
  url?: string;
  secret: boolean;
  kind: "text" | "select";
  options?: { value: string; label: string }[];
  source: string;
  configured: boolean;
  preview: string;
}

const TESTABLE: Record<string, string> = {
  GEMINI_API_KEY: "gemini",
  GROQ_API_KEY: "groq",
  ANTHROPIC_API_KEY: "anthropic",
};

export default function SettingsForm({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, { ok: boolean; message: string } | "loading">>({});

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const { settings } = await res.json();
    setItems(settings);
    setDraft({});
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString("pt-BR"));
  }

  async function test(key: string) {
    setTests((t) => ({ ...t, [key]: "loading" }));
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: TESTABLE[key] }),
    });
    const result = await res.json();
    setTests((t) => ({ ...t, [key]: result }));
  }

  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="max-w-3xl space-y-4">
      {items.map((item) => {
        const result = tests[item.key];
        return (
          <div key={item.key} className={`${card} p-5`}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-zinc-200">{item.label}</label>
              {item.configured && item.source === "env" && (
                <span className={`${pill} bg-white/5 text-zinc-500`}>vindo do .env</span>
              )}
              {item.configured && item.source === "app" && (
                <span className={`${pill} bg-emerald-500/15 text-emerald-400`}>salvo no app</span>
              )}
              {!item.configured && item.secret && (
                <span className={`${pill} bg-amber-500/15 text-amber-400`}>não configurado</span>
              )}
            </div>

            <p className="mb-3 text-xs text-zinc-500">
              {item.help}{" "}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-gold-400 transition duration-200 ease-spring hover:underline"
                >
                  Pegar chave →
                </a>
              )}
            </p>

            <div className="flex flex-wrap gap-2">
              {item.kind === "select" ? (
                <select
                  value={draft[item.key] ?? item.preview}
                  onChange={(e) => setDraft((d) => ({ ...d, [item.key]: e.target.value }))}
                  className={`flex-1 ${campoInset}`}
                >
                  {item.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  // só esconde o que é segredo; alíquota e afins ficam visíveis
                  type={item.secret ? "password" : "text"}
                  value={draft[item.key] ?? (item.secret ? "" : item.preview)}
                  onChange={(e) => setDraft((d) => ({ ...d, [item.key]: e.target.value }))}
                  placeholder={item.secret ? item.preview || "cole a chave aqui" : "0"}
                  className={`min-w-64 flex-1 ${campoInset} font-mono placeholder:font-sans placeholder:text-zinc-600`}
                />
              )}

              {item.key === "WEBHOOK_TOKEN" && (
                <button
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      WEBHOOK_TOKEN: crypto.randomUUID().replace(/-/g, ""),
                    }))
                  }
                  className={`${btnSecondary} hover:border-gold-500/40 hover:text-gold-400`}
                >
                  Gerar
                </button>
              )}

              {TESTABLE[item.key] && item.configured && (
                <button
                  onClick={() => test(item.key)}
                  className={`${btnSecondary} hover:border-gold-500/40 hover:text-gold-400`}
                >
                  {result === "loading" ? "testando..." : "Testar"}
                </button>
              )}
            </div>

            {result && result !== "loading" && (
              <p className={`mt-2 text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                {result.ok ? "✓" : "✗"} {result.message}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!dirty || saving} className={`${btnPrimary} px-6`}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Salvo às {savedAt}</span>}
        {dirty && !saving && (
          <span className="text-xs text-zinc-500">alterações não salvas</span>
        )}
      </div>

      <p className="pt-2 text-xs text-zinc-600">
        As chaves são cifradas com AES-256-GCM antes de ir para o banco. A chave mestra fica
        em <code>~/.scrapper/master.key</code>, fora do projeto, então nem um backup do banco
        nem um commit acidental expõem seus segredos.
      </p>
    </div>
  );
}
