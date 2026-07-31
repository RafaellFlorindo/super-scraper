/**
 * Gera criativos para a NOSSA oferta a partir do criativo do concorrente.
 *
 * O molde é a estrutura, nunca o texto: hook, ritmo, ordem dos argumentos e
 * tipo de prova. Copiar o texto literal derruba a conta de anúncios e não
 * converte melhor, porque o público já viu.
 */
import { db } from "./db";
import { chat } from "./llm";
import { getSetting } from "./settings";
import { pathFor, absolute } from "./storage";
import fs from "node:fs";
import path from "node:path";

/**
 * Descreve o vídeo do concorrente cena a cena, olhando o vídeo de verdade.
 *
 * A transcrição só conta o que é falado. O que faz o criativo funcionar também
 * está no que aparece: enquadramento, cenário, objetos na mão, texto na tela,
 * corte a cada quantos segundos. Isso só sai analisando o arquivo.
 *
 * Só o Gemini aceita vídeo como entrada entre os providers suportados, então
 * esta função independe do LLM_PROVIDER. Sem chave dele, o gerador cai de volta
 * para a transcrição.
 */
export async function describeVideo(creativeId: string): Promise<string | null> {
  const creative = await db.creative.findUnique({ where: { id: creativeId } });
  if (!creative?.localPath || creative.kind !== "video") return null;

  const key = await getSetting("GEMINI_API_KEY");
  if (!key) return null;

  const file = absolute(creative.localPath);
  const bytes = fs.statSync(file).size;
  // limite do envio inline da API
  if (bytes > 18 * 1024 * 1024) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: "video/mp4", data: fs.readFileSync(file).toString("base64") } },
              {
                text: `Descreva este criativo de anúncio cena a cena, para eu conseguir
gravar um vídeo com a mesma ESTRUTURA vendendo outro produto.

Para cada cena diga: intervalo de tempo, enquadramento, cenário, o que aparece
em cena, texto na tela e o que muda em relação à cena anterior.

Depois responda em tópicos curtos:
- Qual é o gancho visual dos primeiros 3 segundos
- Ritmo de corte (a cada quantos segundos)
- Que tipo de prova aparece na imagem
- Como o vídeo termina e chama para a ação

Seja concreto e visual. Não interprete a estratégia de marketing, descreva o que
está na tela.`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) return null;
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

const SYSTEM = `Você é diretor de criação de resposta direta no mercado brasileiro
de infoprodutos.

Recebe um criativo de concorrente que JÁ ESTÁ ESCALANDO e a descrição da oferta do
usuário. Sua tarefa é produzir variações para a oferta DO USUÁRIO, usando o
criativo do concorrente apenas como referência de estrutura.

Regras:
- Cada variação ataca um ÂNGULO PSICOLÓGICO DIFERENTE. Se duas puderem ser
  trocadas sem o público notar, você falhou.
- O VISUAL também muda entre variações. "storyboard" e "imagePrompt" precisam
  ser diferentes em cada uma: cenário, quem aparece, o que está em cena e o
  texto na tela. Repetir o mesmo storyboard nas variações é erro grave, porque
  o público vê a mesma peça e para de responder.
- Cada storyboard reflete o ângulo daquela variação: ângulo de dor abre em
  problema, prova social abre em resultado, e assim por diante.
- Os 5 hooks usam CONSTRUÇÕES DIFERENTES. Se todos começarem com a mesma
  fórmula ("Você sabia que...", "Você quer..."), você falhou. Revise: afirmação
  seca, pergunta, cena, número, contradição, ordem direta.
- Nunca reaproveite frases do concorrente. Extraia o padrão, escreva original.
- Nada de promessa de ganho garantido, cura ou resultado específico: reprova no
  compliance da Meta.
- NUNCA invente prova: número de alunos, anos de mercado, depoimento, prêmio ou
  faturamento só entram se vierem na descrição da oferta. Quando faltar, escreva
  um marcador como [INSERIR Nº REAL DE ALUNOS] em vez de chutar.
- Se a oferta do usuário não estiver descrita, assuma uma plausível a partir do
  concorrente e siga. Não pergunte nada.
- Não use travessão (—) em nenhum texto.

- Se vier a descrição visual do vídeo do concorrente, espelhe a ESTRUTURA de
  cenas em "storyboard": mesmo ritmo de corte e mesma função de cada cena, com
  conteúdo nosso. É o roteiro de gravação, para a pessoa filmar seguindo.

Responda SOMENTE com um array JSON, sem markdown, no formato:
[
  {
    "angle": "nome curto do ângulo",
    "hook": "primeira frase, os 3 primeiros segundos",
    "script": "roteiro falado completo, com marcações de tempo",
    "storyboard": "cena a cena: [0-3s] enquadramento, o que aparece, texto na tela. [3-8s] ...",
    "primaryText": "texto que vai no corpo do anúncio",
    "headline": "título curto",
    "imagePrompt": "descrição visual em inglês para gerar a imagem de capa"
  }
]`;

export interface GenerateOptions {
  projectId: string;
  /** Criativo do concorrente usado de molde. */
  sourceCreativeId?: string;
  count?: number;
}

export async function generateCreatives(opts: GenerateOptions) {
  const project = await db.project.findUnique({
    where: { id: opts.projectId },
    include: {
      modeledAd: { include: { advertiser: true, creatives: true, funnel: true } },
    },
  });
  if (!project) throw new Error("Projeto não encontrado");

  const ad = project.modeledAd;
  const source = opts.sourceCreativeId
    ? await db.creative.findUnique({ where: { id: opts.sourceCreativeId } })
    : ad?.creatives.find((c) => c.transcript) ?? ad?.creatives[0];

  // olha o vídeo, não só o que é falado nele
  const cenas = source?.kind === "video" ? await describeVideo(source.id) : null;

  const referencia = [
    ad && `Anunciante: ${ad.advertiser.name}`,
    ad?.niche && `Nicho: ${ad.niche}`,
    ad?.angle && `Ângulo do concorrente: ${ad.angle}`,
    ad?.funnel?.detectedPrice && `Preço dele: ${ad.funnel.detectedPrice}`,
    ad?.headline && `Headline dele: ${ad.headline}`,
    ad?.primaryText && `Copy dele:\n${ad.primaryText.slice(0, 1500)}`,
    source?.transcript &&
      `\nROTEIRO DO VÍDEO DELE (transcrição):\n${source.transcript.slice(0, 6000)}`,
    cenas && `\nCOMO O VÍDEO DELE É VISUALMENTE, cena a cena:\n${cenas}`,
  ]
    .filter(Boolean)
    .join("\n");

  const nossa =
    project.ownerOffer?.trim() ||
    "O usuário ainda não descreveu a oferta dele. Assuma uma oferta concorrente " +
      "direta no mesmo nicho e sinalize no ângulo que os dados são suposição.";

  const raw = await chat(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `CRIATIVO DE REFERÊNCIA:\n${referencia}\n\nA NOSSA OFERTA:\n${nossa}\n\nGere ${
          opts.count ?? 5
        } variações.`,
      },
    ],
    { json: true }
  );

  const parsed = parseArray(raw);

  const criados = [];
  for (const v of parsed) {
    criados.push(
      await db.generatedCreative.create({
        data: {
          projectId: opts.projectId,
          sourceCreativeId: source?.id ?? null,
          angle: str(v.angle),
          hook: str(v.hook),
          script: str(v.script),
          storyboard: str(v.storyboard),
          primaryText: str(v.primaryText),
          headline: str(v.headline),
          imagePrompt: str(v.imagePrompt),
        },
      })
    );
  }
  return criados;
}

/** Modelos variam entre array puro, objeto com chave, e cercado por markdown. */
function parseArray(raw: string): any[] {
  const limpo = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(limpo);
    if (Array.isArray(parsed)) return parsed;
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) return value;
    }
    return [parsed];
  } catch {
    // último recurso: recorta o primeiro array que aparecer no texto
    const match = limpo.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("A IA não devolveu JSON válido.");
  }
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = Array.isArray(v) ? v.join("\n") : String(v);
  return s.trim() || null;
}

// ------------------------------------------------------------------ imagem

/**
 * Gera a imagem do criativo via Gemini.
 *
 * Só o Gemini gera imagem entre os providers configuráveis, então isto independe
 * do LLM_PROVIDER escolhido: se houver chave do Gemini, funciona.
 */
export async function generateImage(generatedId: string): Promise<string> {
  const item = await db.generatedCreative.findUnique({ where: { id: generatedId } });
  if (!item?.imagePrompt) throw new Error("Este criativo não tem prompt de imagem.");

  const key = await getSetting("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      "Geração de imagem precisa de uma chave do Gemini em Configurações. " +
        "Groq e Anthropic não geram imagem."
    );
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: item.imagePrompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const detalhe = await res.text();
    if (res.status === 429) throw new Error("Cota de imagem do Gemini esgotada por hoje.");
    throw new Error(`Gemini imagem ${res.status}: ${detalhe.slice(0, 200)}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p: any) => p.inlineData?.data)?.inlineData;
  if (!inline) throw new Error("O Gemini não devolveu imagem para este prompt.");

  const dest = pathFor("generated", item.projectId, `${item.id}.png`);
  fs.writeFileSync(dest, Buffer.from(inline.data, "base64"));

  const rel = path.relative(pathFor(""), dest).replaceAll("\\", "/");
  await db.generatedCreative.update({ where: { id: item.id }, data: { imagePath: rel } });
  return rel;
}
