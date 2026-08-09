"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Casca da gaveta lateral -- só é montada pela rota interceptada
// (@modal/(.)[id]/page.tsx), então SEMPRE existe uma entrada de histórico
// pra voltar (nunca é alcançada por navegação direta/refresh, essa cai na
// página cheia de verdade). router.back() fecha, tanto pelo fundo/X quanto
// por Esc -- mesmo padrão hand-rolled dos outros diálogos do app
// (MobileActionSheet.tsx, ProductsModalButton.tsx), sem lib nenhuma.
export function RequestDetailModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <>
      <button
        aria-label="Fechar"
        onClick={() => router.back()}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 sm:w-full sm:max-w-2xl overflow-y-auto shadow-lg"
        style={{ background: "var(--surface-1)" }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-end px-4 py-2 border-b"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <button onClick={() => router.back()} className="text-sm px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            ✕ Fechar
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}
