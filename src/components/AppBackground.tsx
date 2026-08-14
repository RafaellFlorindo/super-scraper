/**
 * Fundo único da área logada, atrás de tudo (sidebar + cabeçalho + conteúdo).
 *
 * A ideia é ter UMA fonte de luz na tela — um bloom violeta no alto à
 * esquerda que decai até o preto — em vez de preencher retângulos com cinza.
 * É isso que dá profundidade: as superfícies por cima parecem iluminadas por
 * essa luz, não coladas num fundo chapado.
 *
 * `fixed inset-0` de propósito: preso à viewport, não à altura do conteúdo,
 * então o desenho é idêntico numa página curta e numa de vinte rolagens.
 */
export default function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-900">
      {/* bloom principal: a "lâmpada" da tela, atrás do topo da navegação */}
      <div className="absolute -left-40 -top-56 h-[46rem] w-[46rem] rounded-full bg-[#5b4fe0]/[0.22] blur-[120px]" />
      {/* rebatida fria bem mais fraca, pra luz não morrer no meio da tela */}
      <div className="absolute left-1/3 top-1/4 h-[34rem] w-[34rem] rounded-full bg-[#4f46e5]/[0.07] blur-[130px]" />
      {/* brasa quente no rodapé: só um respiro de temperatura no canto oposto */}
      <div className="absolute -bottom-40 -left-20 h-[26rem] w-[26rem] rounded-full bg-sun-500/[0.06] blur-[110px]" />

      {/* textura de pontos: tira o "liso digital" do degradê sem virar ruído */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, #a5a0ff 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* vinheta: fecha as bordas e empurra o olho pro conteúdo */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
    </div>
  );
}
