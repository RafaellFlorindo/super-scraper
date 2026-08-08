/**
 * Configuração da aplicação, editável pela interface.
 *
 * Ordem de precedência: banco → variável de ambiente. Assim o .env continua
 * funcionando (útil no worker e nos scripts), mas quem mexe pela interface não
 * precisa abrir arquivo nenhum.
 *
 * Chaves de API são cifradas em repouso com AES-256-GCM. A chave mestra vive
 * fora do projeto, em ~/.scrapper/master.key, para não ir junto num backup ou
 * num commit acidental do banco.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { db } from "./db";

const KEY_FILE = path.join(os.homedir(), ".scrapper", "master.key");

function masterKey(): Buffer {
  if (!fs.existsSync(KEY_FILE)) {
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return Buffer.from(fs.readFileSync(KEY_FILE, "utf8").trim(), "hex");
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // iv:tag:payload — tudo em hex, num campo de texto só
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Definição das chaves que a interface sabe editar. */
export interface SettingDef {
  key: string;
  label: string;
  help: string;
  url?: string;
  secret: boolean;
  kind: "text" | "select";
  options?: { value: string; label: string }[];
}

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "LLM_PROVIDER",
    label: "Provider de IA",
    help: "Quem escreve as copies e classifica os anúncios.",
    secret: false,
    kind: "select",
    options: [
      { value: "gemini", label: "Google Gemini (grátis)" },
      { value: "groq", label: "Groq (grátis, cota separada)" },
      { value: "anthropic", label: "Anthropic Claude (pago, melhor copy)" },
    ],
  },
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    help: "Classifica os anúncios e move os agentes. Grátis, sem cartão.",
    url: "https://aistudio.google.com/apikey",
    secret: true,
    kind: "text",
  },
  {
    key: "GROQ_API_KEY",
    label: "Groq API Key",
    help: "Transcreve as VSLs em texto. Grátis. Também serve de provider de IA.",
    url: "https://console.groq.com/keys",
    secret: true,
    kind: "text",
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    help: "Opcional. Melhor qualidade de copy, mas é pago por uso.",
    url: "https://console.anthropic.com/settings/keys",
    secret: true,
    kind: "text",
  },
  {
    key: "HIGGSFIELD_API_KEY",
    label: "Higgsfield API Key",
    help: "Gera vídeo com IA (imagem em movimento, avatares) para os criativos do estúdio.",
    url: "https://higgsfield.ai/",
    secret: true,
    kind: "text",
  },
  {
    key: "HIGGSFIELD_API_SECRET",
    label: "Higgsfield API Secret",
    help: "O par da chave acima — a API do Higgsfield autentica com chave + segredo.",
    url: "https://higgsfield.ai/",
    secret: true,
    kind: "text",
  },
  {
    key: "ELEVENLABS_API_KEY",
    label: "ElevenLabs API Key",
    help: "Opcional. Narração premium para os vídeos, no lugar da voz gratuita do edge-tts.",
    url: "https://elevenlabs.io/app/settings/api-keys",
    secret: true,
    kind: "text",
  },
  {
    key: "RUNWAY_API_KEY",
    label: "Runway API Key",
    help: "Opcional. Alternativa ao Higgsfield para gerar vídeo com IA.",
    url: "https://dev.runwayml.com/",
    secret: true,
    kind: "text",
  },
  {
    key: "WEBHOOK_TOKEN",
    label: "Token de webhook",
    help: "Senha da URL que recebe suas vendas. O endpoint é público, então sem token ele recusa tudo. Gere um valor longo e aleatório.",
    secret: true,
    kind: "text",
  },
  {
    key: "TAX_PERCENT",
    label: "Alíquota de imposto (%)",
    help: "Usada para calcular imposto e lucro no Traqueamento. Deixe 0 se não quiser considerar.",
    secret: false,
    kind: "text",
  },
  {
    key: "SCRAPER_HEADFUL",
    label: "Mostrar o navegador ao minerar",
    help: "Deixe desligado. Ligue só se a Meta pedir captcha e você precisar resolver na mão uma vez.",
    secret: false,
    kind: "select",
    options: [
      { value: "", label: "Não, roda invisível (recomendado)" },
      { value: "1", label: "Sim, abre a janela do Chrome" },
    ],
  },
];

const SECRET_KEYS = new Set(SETTING_DEFS.filter((d) => d.secret).map((d) => d.key));

/** Cache curto: o worker chama isto a cada job e não vale bater no banco sempre. */
let cache: { at: number; values: Record<string, string> } | null = null;
const CACHE_MS = 5000;

async function loadAll(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;

  const rows = await db.setting.findMany();
  const values: Record<string, string> = {};
  for (const row of rows) {
    try {
      values[row.key] = row.encrypted ? decrypt(row.value) : row.value;
    } catch {
      // chave mestra trocada ou valor corrompido: ignora e cai no .env
    }
  }
  cache = { at: Date.now(), values };
  return values;
}

/** Valor efetivo: banco primeiro, senão .env, senão o padrão. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const values = await loadAll();
  return values[key] || process.env[key] || fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const secret = SECRET_KEYS.has(key);

  if (!value) {
    await db.setting.deleteMany({ where: { key } });
  } else {
    const stored = secret ? encrypt(value) : value;
    await db.setting.upsert({
      where: { key },
      create: { key, value: stored, encrypted: secret },
      update: { value: stored, encrypted: secret },
    });
  }
  cache = null;
}

/** Para a interface: nunca devolve o segredo, só se existe e uma prévia. */
export async function getMaskedSettings() {
  const values = await loadAll();
  return SETTING_DEFS.map((def) => {
    const fromDb = values[def.key] ?? "";
    const fromEnv = process.env[def.key] ?? "";
    const effective = fromDb || fromEnv;
    return {
      ...def,
      source: fromDb ? "app" : fromEnv ? "env" : "none",
      configured: Boolean(effective),
      // segredo vira prévia; o resto vai inteiro para preencher o select
      preview: def.secret
        ? effective
          ? `${effective.slice(0, 6)}${"•".repeat(12)}${effective.slice(-4)}`
          : ""
        : effective,
    };
  });
}
