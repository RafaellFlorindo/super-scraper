/**
 * Normaliza webhooks de checkout num formato único.
 *
 * Cada plataforma inventa o seu payload: nomes de campo diferentes, status em
 * português ou inglês, valor em reais ou centavos, UTM ora no topo ora aninhado
 * em "tracking". Todo esse ruído morre aqui — o resto do app só conhece `Sale`.
 */

export interface NormalizedSale {
  platform: string;
  externalId: string;
  status: "paid" | "pending" | "refunded" | "chargeback" | "canceled";
  amountCents: number;
  currency: string;
  productName?: string;
  buyerMasked?: string;
  paymentMethod: "pix" | "cartao" | "boleto" | "outros";
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  occurredAt: Date;
}

/** ana.silva@gmail.com → an***@gmail.com */
export function maskEmail(email?: string | null): string | undefined {
  if (!email || !email.includes("@")) return undefined;
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

const STATUS_MAP: Record<string, NormalizedSale["status"]> = {
  paid: "paid", approved: "paid", aprovado: "paid", pago: "paid",
  complete: "paid", completed: "paid", authorized: "paid",
  waiting_payment: "pending", pending: "pending", pendente: "pending",
  refunded: "refunded", reembolsado: "refunded", refund: "refunded",
  chargeback: "chargeback", chargedback: "chargeback",
  canceled: "canceled", cancelled: "canceled", cancelado: "canceled",
  refused: "canceled", recusado: "canceled",
};

function normalizeStatus(raw?: string): NormalizedSale["status"] {
  return STATUS_MAP[String(raw ?? "").toLowerCase().trim()] ?? "pending";
}

/**
 * Forma de pagamento. Cada plataforma usa um vocabulário próprio
 * ("credit_card", "cartao_credito", "CREDIT"), então o casamento é por trecho.
 */
function normalizePayment(raw?: unknown): NormalizedSale["paymentMethod"] {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("pix")) return "pix";
  if (s.includes("boleto") || s.includes("bank_slip")) return "boleto";
  if (s.includes("card") || s.includes("cartao") || s.includes("cartão") || s.includes("credit"))
    return "cartao";
  return "outros";
}

/**
 * Converte para centavos.
 *
 * A unidade é declarada por plataforma, nunca inferida: em JavaScript `197.0` e
 * `197` são o mesmo número, então qualquer heurística transformaria R$ 197,00
 * em R$ 1,97 mais cedo ou mais tarde. Kiwify manda centavos; Cakto manda reais.
 */
function toCents(value: unknown, unit: "cents" | "reais"): number {
  if (typeof value === "number") {
    return unit === "cents" ? Math.round(value) : Math.round(value * 100);
  }

  const s = String(value ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  // "1.234,56" (BR) vs "1234.56" (US)
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;

  return unit === "cents" ? Math.round(n) : Math.round(n * 100);
}

/** Procura UTMs em qualquer lugar do payload — cada plataforma aninha diferente. */
function findUtms(obj: any): Partial<NormalizedSale> {
  const found: Record<string, string> = {};
  const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  const walk = (value: unknown, depth = 0) => {
    if (depth > 6 || value === null || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (KEYS.includes(key) && typeof v === "string" && v) {
        found[key] ??= v;
      }
      // algumas plataformas mandam a query string inteira num campo só
      if (typeof v === "string" && v.includes("utm_")) {
        try {
          const qs = new URLSearchParams(v.includes("?") ? v.split("?")[1] : v);
          for (const key of KEYS) {
            const got = qs.get(key);
            if (got) found[key] ??= got;
          }
        } catch {
          /* não era query string */
        }
      }
      walk(v, depth + 1);
    }
  };
  walk(obj);

  return {
    utmSource: found.utm_source,
    utmMedium: found.utm_medium,
    utmCampaign: found.utm_campaign,
    utmContent: found.utm_content,
    utmTerm: found.utm_term,
  };
}

function pickDate(...candidates: unknown[]): Date {
  for (const c of candidates) {
    if (!c) continue;
    const d = typeof c === "number" ? new Date(c > 1e12 ? c : c * 1000) : new Date(String(c));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

// ------------------------------------------------------------------ Kiwify
function fromKiwify(body: any): NormalizedSale {
  const order = body.order ?? body;
  return {
    platform: "kiwify",
    externalId: String(order.order_id ?? order.id ?? body.order_id ?? crypto.randomUUID()),
    status: normalizeStatus(order.order_status ?? body.order_status ?? body.webhook_event_type),
    // Kiwify trabalha em centavos
    amountCents: toCents(
      order.Commissions?.charge_amount ?? order.charge_amount ?? order.total_price ?? body.total,
      "cents"
    ),
    currency: String(order.Commissions?.currency ?? "BRL").toUpperCase(),
    productName: order.Product?.product_name ?? order.product_name,
    buyerMasked: maskEmail(order.Customer?.email ?? body.customer?.email),
    paymentMethod: normalizePayment(order.payment_method ?? body.payment_method),
    ...findUtms(body),
    occurredAt: pickDate(order.updated_at, order.created_at, body.created_at),
  };
}

// ------------------------------------------------------------------- Cakto
function fromCakto(body: any): NormalizedSale {
  const data = body.data ?? body;
  return {
    platform: "cakto",
    externalId: String(data.id ?? data.transaction_id ?? data.order_id ?? crypto.randomUUID()),
    status: normalizeStatus(data.status ?? body.event ?? body.status),
    // Cakto trabalha em reais
    amountCents: toCents(data.amount ?? data.total ?? data.value ?? data.price, "reais"),
    currency: String(data.currency ?? "BRL").toUpperCase(),
    productName: data.product?.name ?? data.product_name ?? data.offer?.name,
    buyerMasked: maskEmail(data.customer?.email ?? data.buyer?.email),
    paymentMethod: normalizePayment(data.payment_method ?? data.paymentMethod ?? data.method),
    ...findUtms(body),
    occurredAt: pickDate(data.paid_at, data.updated_at, data.created_at),
  };
}

/** Fallback: formato desconhecido, tenta o melhor possível sem quebrar. */
function fromGeneric(platform: string, body: any): NormalizedSale {
  return {
    platform,
    externalId: String(body.id ?? body.order_id ?? body.transaction_id ?? crypto.randomUUID()),
    status: normalizeStatus(body.status ?? body.event),
    // plataforma desconhecida: assume reais, que é o mais comum em payload cru
    amountCents: toCents(body.amount ?? body.value ?? body.total ?? body.price, "reais"),
    currency: String(body.currency ?? "BRL").toUpperCase(),
    productName: body.product_name ?? body.product?.name,
    buyerMasked: maskEmail(body.email ?? body.customer?.email),
    paymentMethod: normalizePayment(body.payment_method ?? body.paymentMethod),
    ...findUtms(body),
    occurredAt: pickDate(body.created_at, body.date),
  };
}

export const PLATFORMS = ["kiwify", "cakto"] as const;

export function normalize(platform: string, body: unknown): NormalizedSale {
  switch (platform) {
    case "kiwify":
      return fromKiwify(body);
    case "cakto":
      return fromCakto(body);
    default:
      return fromGeneric(platform, body);
  }
}
