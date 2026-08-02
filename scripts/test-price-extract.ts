import { extractPrice } from "../src/lib/price-extract.js";

const casos: [string, string | null][] = [
  ["Frete R$ 9,90 ... De R$ 497 por apenas R$ 197,00 no cartão", "R$ 197,00"],
  ["12x de R$ 19,90 sem juros", "R$ 238,80"],
  ["Acesso por apenas R$ 47", "R$ 47,00"],
  ["De R$ 997,00 por R$ 297,00 ou 12x de R$ 29,70", "R$ 297,00"],
  ["Sem preço nenhum aqui", null],
  ["CNPJ 12.345.678/0001-90 e R$ 97,00 à vista. R$ 97,00 no pix.", "R$ 97,00"],
  ["R$ 5,00 de frete", null],
];

let ok = 0;
for (const [texto, esperado] of casos) {
  const got = extractPrice(texto);
  const passou = got === esperado;
  if (passou) ok++;
  console.log(`${passou ? "✓" : "✗"} "${texto.slice(0, 50)}" -> ${got} (esperado ${esperado})`);
}
console.log(`\n${ok}/${casos.length} casos ok`);
