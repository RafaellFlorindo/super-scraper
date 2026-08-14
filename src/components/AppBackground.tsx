/**
 * Fundo único da área logada, atrás de tudo (sidebar + cabeçalho + conteúdo).
 *
 * Antes o degradê vivia só dentro do <aside> (256px), e o resto da página
 * era um preto chapado (bg-ink-900 do body) — dava uma emenda dura bem no
 * topo, exatamente onde fica o cabeçalho com o selo de conquistas e o menu
 * do usuário. Fixed + inset-0 cobre a tela inteira e não depende da altura
 * do conteúdo de cada rota, então fica igual em toda página sem costura.
 */
export default function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1030] via-black to-black" />
      <div className="absolute -left-24 -top-24 h-[32rem] w-[32rem] rounded-full bg-[#4f46e5]/20 blur-3xl" />
      <div className="absolute -left-10 bottom-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/[0.06] via-[#4f2fd0]/15 to-transparent" />
      {/* textura de pontos, como no cartão do plano */}
      <div
        className="absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage: "radial-gradient(circle, #a5a0ff 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
    </div>
  );
}
