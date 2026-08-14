/**
 * Fundo único da área logada — preto absoluto + grid de linhas + um bloom
 * de canto, na linha direta das referências: preto de verdade (não um
 * "ink-900" arroxeado que nunca lê como preto), grade técnica visível (não
 * pontinhos discretos), e o acento vive em GLOW pontual nos elementos que
 * importam (ver `.glow-ring` em globals.css), não espalhado no fundo.
 */
export default function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      {/* grade técnica — o traço que as três referências têm e nós não tínhamos */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* grade fina por dentro de cada célula, bem mais fraca — dá densidade
          sem virar ruído visual */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* bloom único, concentrado no canto — não um borrão cobrindo a tela */}
      <div className="absolute -left-32 -top-32 h-[38rem] w-[38rem] rounded-full bg-[#6c63ff]/[0.28] blur-[100px]" />
      <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-[#8f88ff]/[0.35] blur-[70px]" />

      {/* a grade só existe onde a luz alcança: fora do bloom ela desaparece
          no preto, exatamente como grid-sobre-preto costuma ler */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_8%_0%,transparent_0%,black_75%)]" />
    </div>
  );
}
