/**
 * Confere que as rotas protegidas recusam quem não tem sessão, e que as
 * públicas continuam abertas: npm run test-auth
 */
import "dotenv/config";

const base = "http://localhost:3000";

const PROTEGIDAS = ["/", "/traqueamento", "/config", "/historico", "/clones", "/projetos", "/funis"];
const PUBLICAS = ["/login", "/api/webhook/kiwify"];

console.log("\n  ROTAS PROTEGIDAS (esperado: redirecionar para /login)");
let falhas = 0;
for (const rota of PROTEGIDAS) {
  const res = await fetch(base + rota, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = res.status >= 300 && res.status < 400 && loc.includes("/login");
  if (!ok) falhas++;
  console.log(`  ${ok ? "✓" : "✗"} ${rota.padEnd(16)} ${res.status} ${loc.replace(base, "")}`);
}

console.log("\n  ROTAS PÚBLICAS (esperado: NÃO redirecionar para login)");
for (const rota of PUBLICAS) {
  const res = await fetch(base + rota, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = !loc.includes("/login");
  if (!ok) falhas++;
  console.log(`  ${ok ? "✓" : "✗"} ${rota.padEnd(22)} ${res.status}`);
}

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
