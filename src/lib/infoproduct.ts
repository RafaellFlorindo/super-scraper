/**
 * Separa infoproduto de negócio local.
 *
 * Buscar "curso de confeitaria" na Ad Library traz 90% de escola técnica de
 * bairro. O que separa não é o texto do anúncio — os dois falam de "curso",
 * "vagas", "inscrições". O que separa é PARA ONDE O CLIQUE VAI:
 *
 *   infoproduto  → checkout de plataforma (Hotmart, Kiwify...) ou domínio
 *                  próprio com VSL/página de captura
 *   negócio local → WhatsApp, Messenger, formulário de unidade, telefone
 *
 * Daí o peso desproporcional do destino. Sinais de texto entram só como
 * desempate, porque isoladamente eles erram muito.
 */

/** Plataformas de checkout de infoproduto no Brasil e exterior. */
const CHECKOUT_HOSTS = [
  "hotmart", "kiwify", "eduzz", "monetizze", "braip", "ticto", "perfectpay",
  "cakto", "greenn", "hubla", "kirvano", "yampi", "doppus", "lastlink",
  "pepper", "digitalmanager", "guru", "clickbank", "samcart", "thrivecart",
];

/** Caminhos típicos de funil de infoproduto. */
const FUNNEL_PATHS = [
  "/vsl", "/oferta", "/checkout", "/inscricao", "/inscrever", "/captura",
  "/lp/", "/pv", "/pagina-de-vendas", "/obrigado", "/aula", "/masterclass",
  "/webinar", "/desafio", "/imersao", "/ebook", "/mentoria", "/cadastro",
  "/quiz", "/gratuito", "/gratis", "/turma", "/evento", "/workshop",
];

/**
 * Subdomínios que quase só existem em operação de tráfego pago para digital.
 * Peso menor que o checkout: escola presencial também usa "lp." às vezes, então
 * isto sozinho não decide — precisa somar com outro sinal.
 */
const FUNNEL_SUBDOMAINS = [
  "lp.", "pay.", "checkout.", "go.", "link.", "inscricao.", "inscricoes.",
  "quero", "membros.", "area.", "academia.", "conteudo.",
];

/** Destinos que praticamente garantem negócio local. */
const LOCAL_HOSTS = ["api.whatsapp.com", "wa.me", "m.me", "messenger.com", "chat.whatsapp.com"];

/** Termos que denunciam operação física/presencial. */
const LOCAL_TERMS = [
  "unidade", "nossa escola", "presencial", "matrícula", "matricula",
  "venha nos visitar", "agende sua visita", "polo", "campus", "franquia",
  "atendemos", "aqui na", "endereço", "bairro", "prefeitura", "sesc", "senac",
];

/** Termos típicos de oferta digital. */
const INFO_TERMS = [
  "do zero", "passo a passo", "no conforto de casa", "onde estiver",
  "acesso vitalício", "acesso imediato", "área de membros", "aulas gravadas",
  "100% online", "renda extra", "trabalhar de casa", "certificado digital",
  "garantia de 7 dias", "método", "mentoria", "e-book", "ebook",
];

export interface InfoInput {
  ctaUrl?: string | null;
  /** URL final depois de seguir redirects — vale mais que a ctaUrl. */
  finalUrl?: string | null;
  advertiserName?: string | null;
  primaryText?: string | null;
  headline?: string | null;
  hasVideo?: boolean;
}

function hostOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Escolas locais nomeiam a unidade: "Instituto Gourmet Tijuca". */
function looksLikeBranch(name?: string | null): boolean {
  if (!name) return false;
  return /\s[-–]\s?[A-Z]{2}$|unidade|filial|polo\b|campus/i.test(name);
}

export interface InfoResult {
  score: number;
  isInfoproduct: boolean;
  reasons: string[];
}

export function classifyInfoproduct(input: InfoInput): InfoResult {
  const url = (input.finalUrl || input.ctaUrl || "").toLowerCase();
  const host = hostOf(input.finalUrl) || hostOf(input.ctaUrl);
  const text = `${input.headline ?? ""} ${input.primaryText ?? ""}`.toLowerCase();
  const reasons: string[] = [];

  let score = 40; // neutro

  // --- destino: o sinal dominante ---------------------------------------
  if (LOCAL_HOSTS.some((h) => host.includes(h))) {
    score -= 45;
    reasons.push("clique vai para WhatsApp/Messenger");
  }

  const checkout = CHECKOUT_HOSTS.find((h) => host.includes(h));
  if (checkout) {
    score += 45;
    reasons.push(`checkout em ${checkout}`);
  }

  const funnelPath = FUNNEL_PATHS.find((p) => url.includes(p));
  if (funnelPath) {
    score += 25;
    reasons.push(`caminho de funil (${funnelPath})`);
  }

  const subdomain = FUNNEL_SUBDOMAINS.find((s) => host.startsWith(s) || host.includes(`.${s}`));
  if (subdomain) {
    score += 12;
    reasons.push(`subdomínio de funil (${subdomain})`);
  }

  if (!host) {
    score -= 10;
    reasons.push("sem link de destino");
  }

  // Facebook como destino final = post impulsionado, não funil
  if (host.includes("facebook.com") || host.includes("instagram.com")) {
    score -= 25;
    reasons.push("destino é a própria rede social");
  }

  // --- anunciante --------------------------------------------------------
  if (looksLikeBranch(input.advertiserName)) {
    score -= 20;
    reasons.push("nome do anunciante indica unidade física");
  }

  // --- texto: desempate ---------------------------------------------------
  const localHits = LOCAL_TERMS.filter((t) => text.includes(t));
  if (localHits.length) {
    score -= Math.min(20, localHits.length * 7);
    reasons.push(`termos de operação local: ${localHits.slice(0, 3).join(", ")}`);
  }

  const infoHits = INFO_TERMS.filter((t) => text.includes(t));
  if (infoHits.length) {
    score += Math.min(20, infoHits.length * 7);
    reasons.push(`termos de oferta digital: ${infoHits.slice(0, 3).join(", ")}`);
  }

  // VSL em vídeo é o formato padrão do nicho
  if (input.hasVideo) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, isInfoproduct: score >= 60, reasons };
}
