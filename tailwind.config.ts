import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tema "exchange": preto-azulado profundo com acento violeta.
        // Os NOMES das escalas ficaram os mesmos (ink/gold) de propósito —
        // são usados em centenas de classes; trocar só os valores aqui
        // re-pinta o app inteiro sem tocar em componente nenhum.
        ink: { 900: "#07090f", 800: "#0d1017", 700: "#151a24", 600: "#1d2433" },
        gold: { 300: "#b9b5ff", 400: "#8f88ff", 500: "#6c63ff" },
        // dourado de verdade, para acentos pontuais (CTA de modelar, aba
        // ativa) — só violeta deixava o app monocromático demais
        sun: { 300: "#f5d98a", 400: "#e8c264", 500: "#d4a72c" },
      },
      fontFamily: {
        // SF Pro nos sistemas Apple, com fallback decente em todo o resto
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      transitionTimingFunction: {
        // easing "molinha" no estilo das animações da Apple, em vez do ease padrão
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      boxShadow: {
        // sombra difusa e baixa, tipo cartão/superfície flutuante do macOS
        apple: "0 1px 2px rgba(0,0,0,0.35), 0 12px 28px -12px rgba(0,0,0,0.55)",
        // a mesma, com um anel dourado sutil por fora — hover de card clicável
        "apple-glow":
          "0 0 0 1px rgba(232,194,100,0.12), 0 1px 2px rgba(0,0,0,0.35), 0 16px 32px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
} satisfies Config;
