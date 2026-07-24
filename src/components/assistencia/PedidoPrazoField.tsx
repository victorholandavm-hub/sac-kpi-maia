"use client";

import { useState } from "react";
import { setPedidoPrazoAction } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

// Previsão de entrega — fábrica ou CD podem definir/editar a qualquer
// momento (nunca obrigatório, independente do status atual do pedido).
export function PedidoPrazoField({ pedidoId, prazoEntrega }: { pedidoId: string; prazoEntrega: string | null }) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(prazoEntrega ?? "");

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          Previsão de entrega:{" "}
          <span style={{ color: prazoEntrega ? "var(--text-primary)" : "var(--text-muted)", fontWeight: prazoEntrega ? 600 : 400 }}>
            {prazoEntrega ? formatDate(prazoEntrega) : "não definida"}
          </span>
        </span>
        <button onClick={() => setEditing(true)} className="text-xs underline shrink-0" style={{ color: "var(--text-secondary)" }}>
          {prazoEntrega ? "editar" : "definir"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Previsão de entrega
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <button
        disabled={pending}
        onClick={() =>
          run(async () => {
            await setPedidoPrazoAction(pedidoId, value || null);
            setEditing(false);
          }, value ? "Previsão atualizada." : "Previsão removida.")
        }
        className="text-xs rounded px-3 py-2 disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Salvar
      </button>
      {prazoEntrega ? (
        <button
          disabled={pending}
          onClick={() =>
            run(async () => {
              await setPedidoPrazoAction(pedidoId, null);
              setValue("");
              setEditing(false);
            }, "Previsão removida.")
          }
          className="text-xs underline disabled:opacity-60"
          style={{ color: "var(--status-critical)" }}
        >
          remover
        </button>
      ) : null}
      <button
        onClick={() => {
          setEditing(false);
          setValue(prazoEntrega ?? "");
        }}
        className="text-xs underline"
        style={{ color: "var(--text-secondary)" }}
      >
        cancelar
      </button>
    </div>
  );
}
