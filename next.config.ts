import type { NextConfig } from "next";

/**
 * Pacotes que dependem do próprio `__dirname` real para achar um binário ou
 * arquivo (ffmpeg-static, playwright) precisam ficar de fora do bundle do
 * servidor. Empacotados, o `__dirname` interno deles aponta para dentro de
 * `.next/server/...`, um caminho que não existe, e a resolução falha em
 * silêncio: foi o que fazia `checkDeps()` reportar "ffmpeg" como ausente
 * mesmo com o pacote instalado — funcionava rodando via `tsx`, e quebrava
 * só dentro do processo do `next dev`/`next start`.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "playwright", "playwright-core"],
};

export default nextConfig;
