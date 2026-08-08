/**
 * Confere que as rotas protegidas exigem sessão, e que as públicas continuam
 * abertas: npm run test-auth
 *
 * O app é single-user: quem chega sem cookie não vê tela de login, é mandado
 * para /api/auto-login, que cria a sessão do admin e devolve para a rota
 * pedida. O que o teste garante é que nenhuma rota protegida RENDERIZA para
 * quem não tem cookie — ela tem que redirecionar para o porteiro antes.
 */
import "dotenv/config";

const base = "http://localhost:3000";
const PORTEIRO = "/api/auto-login";

const PROTEGIDAS = ["/", "/traqueamento", "/config", "/historico", "/clones", "/projetos", "/funis"];
const PUBLICAS = ["/instalar", "/api/webhook/kiwify"];

console.log(`\n  ROTAS PROTEGIDAS (esperado: redirecionar para ${PORTEIRO})`);
let falhas = 0;
for (const rota of PROTEGIDAS) {
  const res = await fetch(base + rota, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = res.status >= 300 && res.status < 400 && loc.includes(PORTEIRO);
  if (!ok) falhas++;
  console.log(`  ${ok ? "✓" : "✗"} ${rota.padEnd(16)} ${res.status} ${loc.replace(base, "")}`);
}

console.log(`\n  ROTAS PÚBLICAS (esperado: NÃO passar pelo ${PORTEIRO})`);
for (const rota of PUBLICAS) {
  const res = await fetch(base + rota, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = !loc.includes(PORTEIRO);
  if (!ok) falhas++;
  console.log(`  ${ok ? "✓" : "✗"} ${rota.padEnd(22)} ${res.status}`);
}

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
