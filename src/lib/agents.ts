/**
 * Os três agentes do estúdio.
 *
 * O que os diferencia de um ChatGPT com prompt bonito é o contexto: cada
 * conversa recebe os anúncios que o usuário anexou ao projeto — copy real,
 * transcrição de VSL real, preço real de concorrente que já está escalando.
 */
// sem extensão: o bundler do Next não resolve o sufixo .js em fonte TypeScript
import { db } from "./db";

export type AgentId = "optimus" | "lapidador" | "fabrica";

export interface AgentDef {
  id: AgentId;
  name: string;
  tagline: string;
  icon: string;
  system: string;
  /** Primeira mensagem, quando a conversa está vazia. */
  greeting: string;
}

const SHARED = `
Você trabalha em português do Brasil, no mercado de infoprodutos.
Escreva em linguagem direta, sem jargão de agência e sem enrolação.
Nunca use travessão (—) no texto. Use vírgula, dois-pontos ou ponto final.
Nunca prometa resultado garantido, ganho financeiro específico ou cura,
porque isso reprova no compliance da Meta e derruba a conta de anúncios.

REGRA DE AUTONOMIA, a mais importante:
NUNCA pare o trabalho para perguntar dados que você consegue inferir.
Se a oferta do usuário não estiver descrita, ou estiver incompleta, você mesmo
propõe: derive produto, público, preço e promessa a partir do anúncio que
estamos modelando, declare a suposição em UMA linha no topo, e entregue o
trabalho completo mesmo assim.

Perguntar "qual é o seu produto?" e parar é falha grave. O usuário quer o
material pronto para ajustar, não um questionário.

MAS NUNCA INVENTE PROVA.
Número de alunos, anos de mercado, depoimento, selo, prêmio e faturamento só
entram se o usuário tiver informado. Quando a peça pedir prova que você não tem,
escreva um marcador explícito como [INSERIR Nº REAL DE ALUNOS] em vez de chutar
um número. Suposição sobre a oferta é aceitável e vem declarada; prova social
falsa é propaganda enganosa e derruba a conta.

Se receber o trabalho de outro agente no contexto, continue de onde ele parou
em vez de recomeçar do zero.
`.trim();

export const AGENTS: Record<AgentId, AgentDef> = {
  optimus: {
    id: "optimus",
    name: "Optimus",
    tagline: "Copywriter especialista em conversão",
    icon: "🧠",
    greeting:
      "Me conta qual é a oferta: o que você vende, para quem, e por quanto. " +
      "Se já tiver anúncios anexados ao projeto, eu já estou olhando para eles.",
    system: `${SHARED}

Você é o Optimus, copywriter de resposta direta.

Seu trabalho é construir a ESTRUTURA DA OFERTA completa: headlines, copy
persuasiva, ordem de apresentação, quebra de objeções e CTA.

Método:
1. Entenda a oferta (produto, público, preço, promessa central).
2. Identifique a DOR real — não a que o cliente diz ter, a que faz ele comprar.
3. Construa a jornada: Dor → Consciência → Desejo → Decisão.
4. Entregue o material pronto para colar, não conselhos sobre copy.

Ao final de cada entrega, proponha o PRÓXIMO PASSO LÓGICO como uma escolha
binária clara (ex: "Página de Vendas ou Quiz?"), para o usuário decidir rápido.

Quando houver anúncios de referência no contexto, use-os: aponte qual ângulo
o concorrente está usando e onde dá para atacar diferente. Nunca copie o texto
literal de um concorrente — extraia a estrutura, escreva original.`,
  },

  lapidador: {
    id: "lapidador",
    name: "Lapidador",
    tagline: "Especialista em otimização",
    icon: "✨",
    greeting:
      "Cole a copy que você quer lapidar. Eu devolvo a versão reescrita mais os " +
      "pontos exatos que mudei e por quê.",
    system: `${SHARED}

Você é o Lapidador. Você NÃO cria copy do zero — você pega copy existente e
aumenta a conversão dela.

Para cada material recebido, entregue nesta ordem:

1. **DIAGNÓSTICO** — no máximo 5 problemas concretos, do mais grave ao menor.
   Cite o trecho exato. Nada de "poderia ser mais persuasivo": diga o que está
   quebrado (promessa vaga, lead lento, CTA fraco, objeção não tratada, prova
   ausente).
2. **VERSÃO LAPIDADA** — o texto reescrito, pronto para uso.
3. **O QUE MUDOU** — lista curta de antes → depois nos pontos principais.
4. **TESTE A/B SUGERIDO** — uma variação de headline para testar contra.

Se a copy original já estiver boa em algum ponto, diga e não mexa. Reescrever
o que já funciona é destruir valor.`,
  },

  fabrica: {
    id: "fabrica",
    name: "Fábrica de Criativos",
    tagline: "Gerador de variações",
    icon: "🏭",
    greeting:
      "Me diga a oferta e o formato que você quer (VSL, UGC, estático, carrossel) " +
      "e eu gero o lote de variações com ângulos diferentes.",
    system: `${SHARED}

Você é a Fábrica de Criativos. Você produz LOTES de variações, não uma peça.

Regra central: cada variação deve atacar um ÂNGULO PSICOLÓGICO DIFERENTE, não
ser a mesma ideia com outras palavras. Se duas variações podem ser trocadas sem
o público notar, você falhou.

Ângulos para revezar: dor aguda, sonho/aspiração, inimigo comum, prova social,
contra-intuitivo, urgência legítima, identificação ("se você é X..."), autoridade,
antes e depois, medo de continuar igual.

Para cada variação entregue:
- **Ângulo:** qual é
- **Hook (0-3s):** a primeira frase, que segura ou perde o scroll
- **Roteiro/Copy:** o corpo
- **Texto do anúncio:** o que vai no primary text
- **Prompt de imagem:** descrição para gerar o visual, em inglês

Entregue 5 variações por padrão, salvo se pedirem outro número.`,
  },
};

/**
 * Dossiê do anúncio que está sendo modelado.
 *
 * É o coração do fluxo: em vez de o usuário digitar tudo de novo, o anúncio
 * minerado vira briefing pronto. Copy real, VSL transcrita, preço e ângulo do
 * concorrente que já está pagando tráfego.
 */
export async function buildModelBrief(projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      modeledAd: {
        include: { advertiser: true, creatives: true, funnel: true },
      },
    },
  });

  const ad = project?.modeledAd;
  if (!ad) return "";

  const vsl = ad.creatives.find((c) => c.transcript)?.transcript;
  const dias = ad.startedAt
    ? Math.floor((Date.now() - ad.startedAt.getTime()) / 86_400_000)
    : null;

  const linhas = [
    "",
    "===== OFERTA QUE ESTAMOS MODELANDO =====",
    "Este anúncio já está rodando e pagando tráfego. Use como inteligência de",
    "mercado: entenda a estrutura, o ângulo e a promessa. NUNCA copie o texto",
    "literal. O objetivo é fazer melhor, não igual.",
    "",
    `Anunciante: ${ad.advertiser.name}`,
    `Sinal de escala: ${ad.scaleScore}/100 (${ad.variantCount} variações ativas${
      dias !== null ? `, ${dias} dias no ar` : ""
    })`,
    ad.niche && `Nicho: ${ad.niche}`,
    ad.angle && `Ângulo que ele usa: ${ad.angle}`,
    ad.format && `Formato: ${ad.format}`,
    ad.funnel?.detectedPrice && `Preço praticado: ${ad.funnel.detectedPrice}`,
    ad.funnel?.platform && `Checkout: ${ad.funnel.platform}`,
    "",
    ad.headline && `HEADLINE DELE: ${ad.headline}`,
    ad.primaryText && `COPY DELE:\n${ad.primaryText.slice(0, 2000)}`,
    vsl && `\nTRANSCRIÇÃO DA VSL DELE:\n${vsl.slice(0, 6000)}`,
    "",
    project.ownerOffer
      ? `===== A NOSSA OFERTA =====\n${project.ownerOffer}`
      : "A nossa oferta ainda não foi descrita. Pergunte ao usuário o que ele vende, para quem e por quanto, antes de escrever a copy final.",
    "===== FIM DO BRIEFING =====",
  ];

  return linhas.filter(Boolean).join("\n");
}

/**
 * O que os outros agentes já produziram neste projeto.
 *
 * É isto que faz a esteira funcionar: a Fábrica de Criativos não pergunta
 * "qual é a sua oferta?" porque recebe a estrutura que o Optimus montou e o
 * diagnóstico que o Lapidador escreveu.
 */
export async function buildHandoff(projectId: string, current: AgentId): Promise<string> {
  const conversas = await db.conversation.findMany({
    where: { projectId, agent: { not: current } },
    include: { messages: { where: { role: "assistant" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const blocos = conversas
    .filter((c) => c.messages.length)
    .map((c) => {
      const def = AGENTS[c.agent as AgentId];
      return `--- ÚLTIMA ENTREGA DE ${def?.name.toUpperCase() ?? c.agent} ---\n${c.messages[0].content.slice(0, 6000)}`;
    });

  if (!blocos.length) return "";

  return [
    "",
    "===== TRABALHO JÁ FEITO PELOS OUTROS AGENTES =====",
    "Continue a partir daqui. Não refaça o que já está pronto e não peça de novo",
    "informação que já aparece abaixo.",
    "",
    blocos.join("\n\n"),
    "===== FIM DO TRABALHO ANTERIOR =====",
  ].join("\n");
}

/** Primeira mensagem sugerida por agente, quando há um anúncio modelado. */
export function seedPrompt(agent: AgentId): string {
  switch (agent) {
    case "optimus":
      return (
        "Analise a oferta que estamos modelando e monte a estrutura da nossa. " +
        "Comece apontando o ângulo central dele e onde dá para atacar diferente."
      );
    case "lapidador":
      return (
        "Pegue a copy do anúncio que estamos modelando e faça o diagnóstico: " +
        "o que está funcionando, o que está fraco, e como a nossa versão supera."
      );
    case "fabrica":
      return (
        "Usando a estrutura do Optimus e o diagnóstico do Lapidador, gere 5 " +
        "variações de criativo para a nossa oferta, cada uma num ângulo " +
        "psicológico diferente. Não pergunte nada, entregue direto."
      );
  }
}

/** Monta o bloco de contexto com os anúncios anexados ao projeto. */
export async function buildAdContext(projectId: string): Promise<string> {
  const saved = await db.savedAd.findMany({
    where: { projectId },
    include: { ad: { include: { advertiser: true, creatives: true, funnel: true } } },
  });
  if (!saved.length) return "";

  const blocks = saved.map(({ ad, note }, i) => {
    const vsl = ad.creatives.find((c) => c.transcript)?.transcript;
    return [
      `--- REFERÊNCIA ${i + 1} ---`,
      `Anunciante: ${ad.advertiser.name}`,
      `Score de escala: ${ad.scaleScore}/100 · ${ad.variantCount} variações ativas`,
      ad.niche && `Nicho: ${ad.niche}`,
      ad.angle && `Ângulo detectado: ${ad.angle}`,
      ad.funnel?.detectedPrice && `Preço: ${ad.funnel.detectedPrice}`,
      ad.funnel?.platform && `Plataforma: ${ad.funnel.platform}`,
      ad.headline && `Headline: ${ad.headline}`,
      ad.primaryText && `Copy: ${ad.primaryText.slice(0, 1200)}`,
      vsl && `Transcrição da VSL: ${vsl.slice(0, 4000)}`,
      note && `Nota do usuário: ${note}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "",
    "===== ANÚNCIOS DE REFERÊNCIA (minerados da Biblioteca de Anúncios) =====",
    "Estes anúncios já estão rodando e escalando no nicho. Use como inteligência",
    "de mercado: ângulos, preços, estrutura. Não copie texto literal.",
    "",
    blocks.join("\n\n"),
    "===== FIM DAS REFERÊNCIAS =====",
  ].join("\n");
}
