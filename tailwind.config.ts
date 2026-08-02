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
    },
  },
  plugins: [],
} satisfies Config;
