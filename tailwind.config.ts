import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0a0a0c", 800: "#111114", 700: "#18181d", 600: "#22222a" },
        gold: { 300: "#f5d98a", 400: "#e8c264", 500: "#d4a72c" },
      },
    },
  },
  plugins: [],
} satisfies Config;
