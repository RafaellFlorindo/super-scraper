/**
 * Tokens de UI compartilhados: o "sistema" por trás do visual do app.
 *
 * Direção: obsidiana iluminada. Fundo preto de verdade, e o que separa uma
 * superfície da outra é LUZ (fio de 1px em cima, degradê sutil, bloom no
 * hover), não mais uma caixa cinza com borda. Antes todo card era o mesmo
 * fill chapado com a mesma borda, e a tela virava um mar de retângulos
 * idênticos — "tudo blocado, tudo da mesma cor".
 *
 * Regras que essas classes seguem:
 * - Superfície de conteúdo usa `.surface` (globals.css): degradê + fio de luz.
 * - Glass/blur só na camada de navegação e em overlays sobre mídia.
 * - Nunca empilhar glass sobre glass.
 * - Acento (violeta/dourado) é RARO e quente: ação primária, estado ativo,
 *   número que importa. Nunca em toda borda e todo chip ao mesmo tempo.
 * - Todo número de dado em mono (`.num`): score, variação, preço, contagem.
 * - Cantos "concêntricos": containers maiores mais arredondados (rounded-2xl),
 *   controles compactos menos (rounded-xl), tags/badges em cápsula (rounded-full).
 * - Easing "spring" em vez do ease padrão do navegador.
 */

/** Input, select ou textarea de formulário direto sobre o fundo da página — altura e foco padronizados. */
export const campo =
  "h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-200 outline-none transition duration-200 ease-spring focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";

/** Mesma coisa, para quando o campo já está dentro de um `card` — precisa de um fundo mais escuro para não sumir. */
export const campoInset =
  "h-10 rounded-xl border border-white/10 bg-ink-900/80 px-3 text-sm text-zinc-200 outline-none transition duration-200 ease-spring focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";

/** Superfície de conteúdo (painel, item de lista/grid) — iluminada, não chapada. */
export const card = "surface";

/** Acrescenta a `card` quando o card inteiro é clicável/interativo. */
export const cardHover =
  "transition duration-300 ease-spring hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lit-glow";

/** Badge/tag compacto, sempre em cápsula. */
export const pill = "rounded-full px-2.5 py-0.5 text-[11px] font-medium";

/** Badge flutuando sobre mídia (thumbnail) — aqui sim cabe um blur leve. */
export const pillFloating = `${pill} bg-ink-900/80 backdrop-blur-md ring-1 ring-white/10`;

/** Título de página: display grande, tracking apertado. */
export const pageTitle =
  "font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-50";

/** Rótulo miúdo em caixa alta acima do título (o "eyebrow" editorial). */
export const eyebrow = "eyebrow";

/**
 * Botão primário (ação principal da tela: Filtrar, Minerar, Salvar...).
 * Gradiente de três tons em vez de fill chapado — é o único elemento que
 * carrega essa temperatura extra, então quando ele acende, todo o resto que
 * está discreto ao redor faz ele saltar de verdade.
 */
export const btnPrimary =
  "h-10 rounded-xl bg-[linear-gradient(115deg,#7c6fff_0%,#6c63ff_45%,#5636c9_100%)] bg-[length:160%_100%] bg-[position:0%_0%] px-5 text-sm font-medium text-white shadow-[0_2px_1px_rgba(255,255,255,0.25)_inset,0_6px_20px_-6px_rgba(108,99,255,0.75)] transition-all duration-300 ease-spring hover:bg-[position:100%_0%] hover:shadow-[0_2px_1px_rgba(255,255,255,0.3)_inset,0_10px_32px_-6px_rgba(108,99,255,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:scale-100";

/** Botão de destaque pontual (dourado de verdade: Modelar oferta, CTAs de conversão). */
export const btnAccent =
  "rounded-xl bg-sun-400 px-4 py-2 text-sm font-medium text-ink-900 transition duration-200 ease-spring hover:bg-sun-300 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";

/** Botão secundário/neutro (cancelar, ação de apoio). */
export const btnSecondary =
  "h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition duration-200 ease-spring hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.97]";

/** Link/botão de texto discreto (ex: "limpar filtro"). */
export const linkGhost =
  "rounded-full px-2.5 py-1 text-xs text-zinc-400 transition duration-200 ease-spring hover:bg-white/5 hover:text-zinc-200";
