"use client";

import { useEffect } from "react";

// Atalho "/" pra focar a busca sem precisar clicar -- pedido do Victor
// 26/09/2026 (redesign do "Minhas encomendas" do SAC, tela de consulta
// rápida no telefone). Ignora quando já tem foco em outro campo de texto
// (senão "/" dentro de uma busca em andamento, por exemplo, recomeçaria o
// foco em vez de digitar a barra). Sem UI própria -- só o efeito;
// `inputId` precisa bater com o id do <input> de busca da tela.
export function SearchShortcutFocus({ inputId }: { inputId: string }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;
      if (e.key !== "/") return;
      const input = document.getElementById(inputId);
      if (!input) return;
      e.preventDefault();
      input.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputId]);

  return null;
}
