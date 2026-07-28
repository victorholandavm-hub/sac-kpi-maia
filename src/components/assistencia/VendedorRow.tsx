"use client";

import { toggleVendedorAtivo } from "@/app/assistencia/admin-actions";
import { useQuickAction } from "./useQuickAction";

// Vendedor não loga em lugar nenhum -- esse cadastro só alimenta o datalist
// do campo "Vendedor responsável" na criação de um pedido de encomenda.
// "ativo" controla só se o nome ainda aparece nas sugestões.
export function VendedorRow({ name, storeName, ativo }: { name: string; storeName: string; ativo: boolean }) {
  const { pending, run } = useQuickAction();

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm" style={{ color: ativo ? "var(--text-secondary)" : "var(--text-muted)" }}>
        {name} <span style={{ color: "var(--text-muted)" }}>— {storeName}</span>
        {!ativo ? <span style={{ color: "var(--status-critical)" }}> (inativo)</span> : null}
      </span>
      <button
        disabled={pending}
        onClick={() => run(() => toggleVendedorAtivo(name, !ativo), ativo ? "Vendedor inativado." : "Vendedor reativado.")}
        className="text-xs underline disabled:opacity-60"
        style={{ color: ativo ? "var(--status-critical)" : "var(--status-good)" }}
      >
        {ativo ? "inativar" : "reativar"}
      </button>
    </div>
  );
}
