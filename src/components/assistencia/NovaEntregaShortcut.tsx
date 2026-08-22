"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Atalho de teclado Alt+N pro botão "+ Nova entrega" -- pedido do Victor
// 21/08/2026: "adicione o atalho de teclado Alt + N para abertura rápida
// da tela de formulário". Sem efeito quando o foco está num campo de
// texto/select (não intercepta digitação normal, ex. alguém digitando
// "n" num campo de busca com Alt apertado sem querer). Componente
// "invisível" -- só existe pelo efeito colateral do listener.
export function NovaEntregaShortcut({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.key.toLowerCase() !== "n") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      e.preventDefault();
      router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [href, router]);

  return null;
}
