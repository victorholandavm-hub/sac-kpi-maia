"use client";

import { useState } from "react";

// Botão fixo no mobile (acima da barra de navegação inferior e à esquerda
// do "+" de nova solicitação, ver MobileNav.tsx -- por isso "right-20" em
// vez de ocupar a largura toda) que abre as ações do chamado numa folha
// deslizante, em vez do bloco ficar perdido no meio do scroll da página. No
// desktop/tablet ("sm" pra cima) continua exatamente como sempre foi, em
// linha no fluxo normal -- só o mobile ganha esse comportamento novo.
export function MobileActionSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden fixed left-4 right-20 bottom-20 z-40 rounded-lg px-4 py-3 font-medium shadow-lg text-sm truncate"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        ⚙ Ações do chamado
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar ações"
            onClick={() => setOpen(false)}
            className="sm:hidden fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="sm:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t max-h-[80vh] overflow-y-auto p-4 flex flex-col gap-3 shadow-lg"
            style={{
              background: "var(--surface-1)",
              borderColor: "var(--border)",
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Ações do chamado
              </span>
              <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
                Fechar
              </button>
            </div>
            {children}
          </div>
        </>
      ) : null}

      <div className="hidden sm:block">{children}</div>
    </>
  );
}
