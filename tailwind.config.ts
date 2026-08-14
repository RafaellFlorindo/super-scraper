import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tema "obsidiana": preto real com acento violeta.
        // Os NOMES das escalas ficaram os mesmos (ink/gold) de propósito —
        // são usados em centenas de classes; trocar só os valores aqui
        // re-pinta o app inteiro sem tocar em componente nenhum.
        //
        // ink-900 é quase preto de verdade (não azulado): é o que faz o brilho
        // violeta parecer LUZ em vez de mais um bloco cinza-azulado.
        ink: { 900: "#05060a", 800: "#0b0d14", 700: "#141821", 600: "#1c2130" },
        gold: { 300: "#b9b5ff", 400: "#8f88ff", 500: "#6c63ff" },
        // dourado de verdade, para acentos pontuais (CTA de modelar, aba
        // ativa) — só violeta deixava o app monocromático demais
        sun: { 300: "#f5d98a", 400: "#e8c264", 500: "#d4a72c" },
      },
      fontFamily: {
        // Display com caráter (grotesk variável, levemente condensada) para
        // títulos; corpo neutro mas não genérico; mono para TODO número —
        // score, variação, preço. É o que dá cara de terminal de mercado em
        // vez de dashboard SaaS qualquer.
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
        // O truque que tira o aspecto "bloco chapado": um fio de luz de 1px na
        // borda de cima faz a superfície parecer iluminada por cima, com a
        // sombra caindo pra baixo. Sem isto todo card vira retângulo morto.
        lit: "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.4), 0 16px 40px -24px rgba(0,0,0,0.9)",
        // hover: mesma luz de cima + bloom violeta por fora, como o campo
        // aceso da referência
        "lit-glow":
          "inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(108,99,255,0.3), 0 8px 24px -8px rgba(108,99,255,0.35), 0 24px 56px -28px rgba(0,0,0,0.95)",
      },
      keyframes: {
        // entrada escalonada da grade: os cards sobem em sequência em vez de
        // aparecerem todos de uma vez, chapados
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
