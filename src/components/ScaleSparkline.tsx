interface Ponto {
  seenAt: Date;
  variantCount: number;
  isActive: boolean;
}

/**
 * Evolução das variações do anúncio ao longo das coletas.
 *
 * Uma coleta só não é tendência: com menos de dois pontos o componente diz isso
 * em vez de desenhar uma linha reta que sugere estabilidade inexistente.
 */
export default function ScaleSparkline({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length < 2) {
    return (
      <p className="text-xs text-zinc-600">
        {pontos.length} coleta. O gráfico aparece a partir da segunda vez que este anúncio
        for minerado.
      </p>
    );
  }

  const W = 260;
  const H = 56;
  const P = 4;

  const valores = pontos.map((p) => p.variantCount);
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const span = max - min || 1;

  const x = (i: number) => P + (i / (pontos.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - min) / span) * (H - P * 2);

  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.variantCount)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1)},${H} L${x(0)},${H} Z`;

  const primeiro = valores[0];
  const ultimo = valores[valores.length - 1];
  const delta = ultimo - primeiro;

  const cor = delta > 0 ? "#199e70" : delta < 0 ? "#d95926" : "#898781";

  return (
    <div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Variações de ${primeiro} para ${ultimo} em ${pontos.length} coletas`}>
        <path d={area} fill={cor} opacity="0.12" />
        <path d={linha} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" />
        {pontos.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.variantCount)}
            r={i === pontos.length - 1 ? 4 : 2.5}
            fill={cor}
          >
            <title>
              {p.seenAt.toLocaleDateString("pt-BR")}: {p.variantCount} variações
            </title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 text-xs">
        <span className="text-zinc-500">{pontos.length} coletas · </span>
        <span style={{ color: cor }}>
          {primeiro} → {ultimo} variações
          {delta !== 0 && ` (${delta > 0 ? "+" : ""}${delta})`}
        </span>
      </div>
    </div>
  );
}
