/**
 * Tokens de UI compartilhados: o "sistema" por trás do refinamento visual
 * estilo Apple (HIG/Liquid Glass adaptado para web). Import direto — são só
 * strings de classe, funcionam em componente server ou client.
 *
 * Regras que essas classes seguem (Liquid Glass, adaptado):
 * - Glass/blur só na camada de navegação e em overlays flutuantes sobre mídia
 *   (sidebar, header, badges sobre thumbnail) — nunca em cards/linhas de
 *   conteúdo, que ficam com fill sólido (bg-ink-800).
 * - Nunca empilhar glass sobre glass.
 * - Cor de destaque (gold/sun) só na ação primária — não em todo elemento.
 * - Cantos "concêntricos": containers maiores mais arredondados (rounded-2xl),
 *   controles compactos menos (rounded-xl), tags/badges em cápsula (rounded-full).
 * - Easing "spring" em vez do ease padrão do navegador.
 */

/** Input, select ou textarea de formulário direto sobre o fundo da página — altura e foco padronizados. */
export const campo =
  "h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-200 outline-none transition duration-200 ease-spring focus:border-sun-400/50 focus:ring-2 focus:ring-sun-400/20";

/** Mesma coisa, para quando o campo já está dentro de um `card` (bg-ink-800) — precisa de um fundo mais escuro para não sumir. */
export const campoInset =
  "h-10 rounded-xl border border-white/10 bg-ink-900 px-3 text-sm text-zinc-200 outline-none transition duration-200 ease-spring focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";

/** Card de conteúdo (painel, item de lista/grid) — sempre fill sólido, nunca glass. */
export const card = "rounded-2xl border border-white/5 bg-ink-800";

/** Acrescenta a `card` quando o card inteiro é clicável/interativo. */
export const cardHover =
  "transition duration-200 ease-spring hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-apple-glow";

/** Badge/tag compacto, sempre em cápsula. */
export const pill = "rounded-full px-2.5 py-0.5 text-[11px] font-medium";

/** Badge flutuando sobre mídia (thumbnail) — aqui sim cabe um blur leve. */
export const pillFloating = `${pill} bg-ink-900/90 backdrop-blur`;

/** Botão primário (ação principal violeta da tela: Filtrar, Minerar, Salvar...). */
export const btnPrimary =
  "h-10 rounded-xl bg-gold-500 px-5 text-sm font-medium text-ink-900 transition duration-200 ease-spring hover:bg-gold-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

/** Botão de destaque pontual (dourado de verdade: Modelar oferta, CTAs de conversão). */
export const btnAccent =
  "rounded-xl bg-sun-400 px-4 py-2 text-sm font-medium text-ink-900 transition duration-200 ease-spring hover:bg-sun-300 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

/** Botão secundário/neutro (cancelar, ação de apoio). */
export const btnSecondary =
  "h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition duration-200 ease-spring hover:bg-white/[0.08] active:scale-[0.97]";

/** Link/botão de texto discreto (ex: "limpar filtro"). */
export const linkGhost =
  "rounded-full px-2.5 py-1 text-xs text-zinc-400 transition duration-200 ease-spring hover:bg-white/5 hover:text-zinc-200";
