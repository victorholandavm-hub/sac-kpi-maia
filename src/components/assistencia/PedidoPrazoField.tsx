"use client";

import { useState } from "react";
import { setPedidoPrazoFabricaCdAction, setPedidoPrazoCdLojaAction } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

const SAVE_ACTION = {
  fabrica_cd: setPedidoPrazoFabricaCdAction,
  cd_loja: setPedidoPrazoCdLojaAction,
};

// Prazo obrigatório por etapa (ver advancePedidoStatus) -- uma vez definido
// (na transição correspondente), continua editável aqui pra correção, mas
// não dá pra remover (é obrigatório, não faria sentido ficar sem data).
export function PedidoPrazoField({
  pedidoId,
  field,
  label,
  value,
  canEdit,
}: {
  pedidoId: string;
  field: "fabrica_cd" | "cd_loja";
  label: string;
  value: string | null;
  canEdit: boolean;
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const save = SAVE_ACTION[field];

  if (!editing) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-lg border p-4"
        style={{ background: "var(--surface-1)", borderColor: "var(--brand-green)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          {label}:{" "}
          <span style={{ color: value ? "var(--text-primary)" : "var(--status-warning)", fontWeight: 600 }}>
            {value ? formatDate(value) : "não definido"}
          </span>
        </span>
        {canEdit ? (
          <button onClick={() => setEditing(true)} className="text-xs underline shrink-0" style={{ color: "var(--text-secondary)" }}>
            {value ? "editar" : "definir"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--brand-green)" }}>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        {label}
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <button
        disabled={pending || !draft}
        onClick={() =>
          run(async () => {
            await save(pedidoId, draft);
            setEditing(false);
          }, "Prazo atualizado.")
        }
        className="text-xs rounded px-3 py-2 disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Salvar
      </button>
      <button
        onClick={() => {
          setEditing(false);
          setDraft(value ?? "");
        }}
        className="text-xs underline"
        style={{ color: "var(--text-secondary)" }}
      >
        cancelar
      </button>
    </div>
  );
}
