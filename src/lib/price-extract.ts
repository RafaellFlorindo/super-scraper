/**
 * Extrai o preço de venda de uma página de vendas a partir do texto visível.
 *
 * O jeito antigo — primeiro "R$" do texto — errava demais: pegava frete,
 * âncora riscada ("de R$ 497"), ou nada quando o preço estava abaixo da dobra.
 * Aqui coletamos TODOS os candidatos e escolhemos pelo contexto:
 *
 *  1. Preço colado em palavra de oferta ("por apenas", "à vista", "hoje")
 *     ganha de tudo.
 *  2. Parcelamento "12x de R$ 19,90" vira o total (12 × 19,90) quando não há
 *     preço à vista melhor — anúncio de infoproduto adora esconder o cheio.
 *  3. Preço precedido de "de R$" (âncora riscada) é descartado.
 *  4. Empate: o preço que mais se repete na página; persistindo, o menor
 *     (páginas repetem o preço real; a âncora aparece uma vez).
 *
 * Valores fora de 10–20.000 reais são ignorados: abaixo é frete/parcela
 * solta, acima é âncora absurda ou CNPJ que parece número.
 */

const RE_PRECO = /R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/gi;
const RE_PARCELA = /(\d{1,2})\s?x\s?(?:de\s?)?R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/gi;

const OFERTA = /(por\s+apenas|apenas|s[oó]\s+hoje|hoje\s+por|[àa]\s+vista|oferta|promo[cç][aã]o|desconto|invista|assinatura|acesso\s+por|por\s*:?\s*$)/i;
const ANCORA = /\bde\s*$/i;
// "Receba até R$ 14.900" (auxílio/indenização/empréstimo) não é preço de
// produto — sem isto, anúncio de benefício/financiamento (comum em nicho de
// "auxílio maternidade") grava o valor do benefício como se fosse ticket, e o
// faturamento estimado do Funil Hacking sai na casa de dezenas de milhões.
const BENEFICIO =
  /(receba|direito\s+a|benef[ií]cio|aux[ií]lio|indeniza[cç][aã]o|financiamento|empr[ée]stimo|saque|restitui[cç][aã]o)/i;

function toNumber(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

function plausivel(v: number): boolean {
  return v >= 10 && v <= 20_000;
}

export function extractPrice(texto: string): string | null {
  const candidatos: { valor: number; peso: number }[] = [];

  // preços simples, com o contexto de até 40 chars antes
  for (const m of texto.matchAll(RE_PRECO)) {
    const valor = toNumber(m[1]);
    if (!plausivel(valor)) continue;

    const antes = texto.slice(Math.max(0, m.index - 40), m.index);
    if (ANCORA.test(antes)) continue; // "de R$ 497" riscado
    if (BENEFICIO.test(antes)) continue; // "receba até R$ 14.900" não é preço
    // parcela ("12x de R$ 19,90") é tratada em separado, não como preço cheio
    if (/\dx\s?(?:de\s?)?$/i.test(antes)) continue;

    candidatos.push({ valor, peso: OFERTA.test(antes) ? 3 : 1 });
  }

  // parcelamentos viram total, com peso baixo (só ganham se não houver melhor)
  for (const m of texto.matchAll(RE_PARCELA)) {
    const total = Number(m[1]) * toNumber(m[2]);
    if (plausivel(total)) candidatos.push({ valor: Math.round(total * 100) / 100, peso: 0.5 });
  }

  if (candidatos.length === 0) return null;

  // soma peso por valor; desempate: mais repetido, depois o menor
  const porValor = new Map<number, { peso: number; vezes: number }>();
  for (const c of candidatos) {
    const atual = porValor.get(c.valor) ?? { peso: 0, vezes: 0 };
    porValor.set(c.valor, { peso: atual.peso + c.peso, vezes: atual.vezes + 1 });
  }

  const [melhor] = [...porValor.entries()].sort(
    (a, b) => b[1].peso - a[1].peso || b[1].vezes - a[1].vezes || a[0] - b[0]
  );

  return `R$ ${melhor[0].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
