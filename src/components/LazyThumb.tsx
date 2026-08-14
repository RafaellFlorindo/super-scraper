"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Card do Banco de Anúncios monta até 60 de uma vez (sem paginação). Um
 * <video> só dispara a requisição de mídia quando ganha `src` — antes disso
 * tudo saía com `src` já preenchido, então o navegador abria dezenas de
 * conexões de rede simultâneas ao entrar na página, mesmo pra cards fora da
 * tela. Aqui o `src` só é atribuído quando o card entra (ou quase entra) no
 * viewport.
 */
export default function LazyThumb({
  src,
  kind,
  className,
}: {
  src: string;
  kind: "video" | "image";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {visible &&
        (kind === "video" ? (
          <video src={src} className="h-full w-full object-cover" muted preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        ))}
    </div>
  );
}
