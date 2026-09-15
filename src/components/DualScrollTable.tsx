"use client";

import { useEffect, useRef } from "react";

// Barra de rolagem duplicada no topo -- pedido do Victor 15/09/2026: em
// tabelas compridas (muitas linhas), a barra de rolagem horizontal só
// aparece no fim da tabela, obrigando rolar a página inteira pra baixo só
// pra conseguir rolar pro lado. Essa barra falsa no topo fica sincronizada
// com o scroll de verdade (scrollLeft espelhado nos dois sentidos) e usa
// um spacer invisível do tamanho do conteúdo real pra ter a mesma largura
// de rolagem. `children` é a própria <table> -- este componente monta o
// único container com overflow-x-auto ao redor dela.
export function DualScrollTable({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<"top" | "bottom" | null>(null);

  useEffect(() => {
    const top = topRef.current;
    const bottom = bottomRef.current;
    const spacer = spacerRef.current;
    if (!top || !bottom || !spacer) return;

    const syncWidth = () => {
      spacer.style.width = `${bottom.scrollWidth}px`;
    };
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(bottom);

    const onTopScroll = () => {
      if (syncingRef.current === "bottom") return;
      syncingRef.current = "top";
      bottom.scrollLeft = top.scrollLeft;
      syncingRef.current = null;
    };
    const onBottomScroll = () => {
      if (syncingRef.current === "top") return;
      syncingRef.current = "bottom";
      top.scrollLeft = bottom.scrollLeft;
      syncingRef.current = null;
    };
    top.addEventListener("scroll", onTopScroll);
    bottom.addEventListener("scroll", onBottomScroll);
    return () => {
      observer.disconnect();
      top.removeEventListener("scroll", onTopScroll);
      bottom.removeEventListener("scroll", onBottomScroll);
    };
  }, []);

  return (
    <div className="min-w-0 flex flex-col">
      <div ref={topRef} className="min-w-0 overflow-x-auto overflow-y-hidden" style={{ height: 17 }}>
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
      <div ref={bottomRef} className="min-w-0 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
