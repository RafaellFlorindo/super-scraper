import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Super Scraper",
  description: "Mineração da Biblioteca de Anúncios da Meta",
};

/**
 * Layout raiz enxuto de propósito: só o casco do documento.
 *
 * A barra lateral e a checagem de sessão vivem em (app)/layout.tsx, para que
 * login, instalação e as páginas clonadas em /p/ não herdem nada disso.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
