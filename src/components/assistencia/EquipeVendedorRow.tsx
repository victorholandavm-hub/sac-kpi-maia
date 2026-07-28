"use client";

import { toggleVendedorAtivoComoGerente } from "@/app/assistencia/loja-equipe-actions";
import { useQuickAction } from "./useQuickAction";

// Mesma UI de VendedorRow.tsx, só que chamando a action do gerente
// (loja-equipe-actions.ts), que verifica que a loja é dele antes de agir.
export function EquipeVendedorRow({ name, storeName, ativo }: { name: string; storeName: string; ativo: boolean }) {
  const { pending, run } = useQuickAction();

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm" style={{ color: ativo ? "var(--text-secondary)" : "var(--text-muted)" }}>
        {name} <span style={{ color: "var(--text-muted)" }}>— {storeName}</span>
        {!ativo ? <span style={{ color: "var(--status-critical)" }}> (inativo)</span> : null}
      </span>
      <button
        disabled={pending}
        onClick={() => run(() => toggleVendedorAtivoComoGerente(name, !ativo), ativo ? "Vendedor inativado." : "Vendedor reativado.")}
        className="text-xs underline disabled:opacity-60"
        style={{ color: ativo ? "var(--status-critical)" : "var(--status-good)" }}
      >
        {ativo ? "inativar" : "reativar"}
      </button>
    </div>
  );
}
