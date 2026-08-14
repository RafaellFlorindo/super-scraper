import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Archivo, JetBrains_Mono } from "next/font/google";

/**
 * Três vozes, de propósito:
 * - display: grotesk variável com caráter, só em títulos e números grandes;
 * - body: neutra mas não genérica, para texto corrido e rótulos;
 * - mono: TODO número (score, variação, preço, contagem). Dado em mono é o
 *   que dá cara de terminal de mercado em vez de dashboard SaaS qualquer.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Archivo({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
