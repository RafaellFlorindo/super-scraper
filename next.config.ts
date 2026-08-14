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
  /**
   * `next build` e `next dev` compartilhando o mesmo `.next` se atropelam: o
   * build apaga chunks que o dev ainda está servindo e a página cai com
   * "Cannot find module for page". Com NEXT_DIST_DIR dá pra buildar num
   * diretório separado sem derrubar o servidor de desenvolvimento.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
