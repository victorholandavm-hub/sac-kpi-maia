"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Barra de progresso simples pra dar feedback de "já registrei seu clique,
// tô navegando". De propósito NÃO usa loading.tsx/Suspense: esse mecanismo
// depende do reveal por requestAnimationFrame do React (streaming SSR), que
// em navegadores embutidos restritos (ex.: o do WhatsApp) pode travar
// mostrando só o fallback pra sempre — bug real reproduzido testando este
// app. Aqui é só clique + mudança de rota, sem streaming nenhum, com um
// timeout de segurança que nunca deixa a barra presa na tela.
function ProgressBar() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // Só mostra se a navegação demorar mais que isso — evita piscar em
      // transições que já são rápidas.
      showTimer = setTimeout(() => setActive(true), 150);
      // Trava de segurança: nunca fica visível pra sempre, mesmo se algo
      // impedir a rota de mudar (esse componente também remonta — e reseta
      // sozinho — a cada mudança de rota, via key no componente pai).
      hideTimer = setTimeout(() => setActive(false), 8000);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none overflow-hidden">
      <div
        className="h-full"
        style={{ background: "var(--brand-green)", width: "40%", animation: "nav-progress-slide 1s ease-in-out infinite" }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  // A key faz o React desmontar/remontar a cada troca de rota — descarta o
  // estado antigo (e os timers, via cleanup do effect) automaticamente, sem
  // precisar de um efeito separado só pra "resetar" o componente.
  return <ProgressBar key={pathname} />;
}
