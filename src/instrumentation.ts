/**
 * Sobe o worker sozinho junto com o servidor — ninguém deveria precisar abrir
 * um segundo terminal e digitar `npm run worker` pra minerar funcionar.
 *
 * `register()` é o hook oficial do Next.js chamado quando o servidor inicia,
 * tanto no runtime Node quanto no edge — e o Next EMPACOTA este arquivo pros
 * dois runtimes, mesmo que o código só rode num deles. Se os módulos nativos
 * (`node:child_process`, `node:fs`) aparecerem como `import()` direto aqui, o
 * bundle do runtime edge quebra o build inteiro com "UnhandledSchemeError",
 * porque edge não tem esses módulos. `eval("require")` existe só pra escapar
 * dessa análise estática do bundler — sem ele o app inteiro fica fora do ar.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const nodeRequire = eval("require") as NodeRequire;
  const { spawn } = nodeRequire("node:child_process") as typeof import("node:child_process");
  const fs = nodeRequire("node:fs") as typeof import("node:fs");
  const path = nodeRequire("node:path") as typeof import("node:path");
  const { db } = (await import("./lib/db")) as typeof import("./lib/db");

  // Já tem um worker batendo heartbeat há pouco (outra instância do servidor,
  // ou alguém rodando `npm run worker` na mão)? Não sobe um segundo.
  const beat = await db.workerHeartbeat.findUnique({ where: { id: "singleton" } }).catch(() => null);
  if (beat && Date.now() - beat.beatAt.getTime() < 15_000) {
    console.log("  worker já está rodando (heartbeat recente) — não subiu outro.");
    return;
  }

  const cwd = process.cwd();
  const tsxCli = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
  const logPath = path.join(cwd, "worker.log");
  const log = fs.openSync(logPath, "a");

  const worker = spawn(process.execPath, [tsxCli, "scripts/worker.ts"], {
    cwd,
    stdio: ["ignore", log, log],
    windowsHide: true,
    env: process.env,
  });
  worker.on("error", (err) => {
    console.error("  [worker] falhou ao subir automaticamente:", err.message);
  });

  console.log(`  worker de mineração iniciado automaticamente (pid ${worker.pid}, log em worker.log)`);
}
