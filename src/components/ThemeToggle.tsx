"use client";

import { useEffect, useState } from "react";

// Alterna a classe `.dark` na <html> (ver globals.css/@custom-variant dark)
// e persiste em localStorage -- pedido do Victor 02/09/2026: "preciso que
// você tenha a opção do modo noturno em todo o sistema". A troca real
// acontece de forma síncrona, direto no DOM (sem esperar re-render), pro
// clique parecer instantâneo; o estado em React (`isDark`) só existe pra
// desenhar o ícone certo.
//
// O valor inicial (antes do primeiro clique) já vem certo da tag
// `<script>` inline no <head> (ver layout.tsx, roda antes da hidratação
// pra não piscar o tema errado) -- aqui só lê o que já está na <html> pra
// não duplicar a lógica de "qual tema começa".
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Só depois de montar (nunca no primeiro render) -- ler
    // document.documentElement direto no corpo do componente faria o
    // primeiro render do cliente já divergir do HTML mandado pelo servidor
    // (que nunca sabe o tema salvo), disparando erro de hydration
    // mismatch. O <script> bloqueante em layout.tsx já aplicou a classe
    // certa na <html> antes disso rodar -- aqui só sincroniza o ícone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Modo privado/storage bloqueado -- a troca visual já aconteceu,
      // só não persiste pra próxima visita. Sem isso quebrar o clique.
    }
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo noturno"}
      title={isDark ? "Modo claro" : "Modo noturno"}
      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base leading-none transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
