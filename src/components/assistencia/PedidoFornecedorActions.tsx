"use client";

import { useState } from "react";
import { markPedidoFornecedorRecebido, cancelPedidoFornecedor, addPedidoFornecedorNoteAction } from "@/app/assistencia/fornecedor-pedido-actions";
import { useQuickAction } from "./useQuickAction";

export function PedidoFornecedorActions({ pedidoId, status }: { pedidoId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const isOpen = status === "pedido_feito";

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {isOpen ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={pending}
            onClick={() => run(() => markPedidoFornecedorRecebido(pedidoId), "Pedido marcado como recebido.")}
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: "var(--status-good)", color: "#fff" }}
          >
            Marcar recebido
          </button>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Pedido encerrado.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Adicionar observação…"
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await addPedidoFornecedorNoteAction(pedidoId, note);
              setNote("");
            }, "Nota adicionada.")
          }
          className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Adicionar nota
        </button>
      </div>

      {isOpen ? (
        showCancel ? (
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Motivo do cancelamento…"
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: "var(--status-critical)" }}
            />
            <div className="flex items-center gap-2">
              <button
                disabled={pending || !cancelReason.trim()}
                onClick={() =>
                  run(async () => {
                    await cancelPedidoFornecedor(pedidoId, cancelReason);
                    setCancelReason("");
                    setShowCancel(false);
                  }, "Pedido cancelado.")
                }
                className="text-sm rounded px-3 py-2 disabled:opacity-60"
                style={{ background: "var(--status-critical)", color: "#fff" }}
              >
                Confirmar cancelamento
              </button>
              <button onClick={() => setShowCancel(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCancel(true)}
            className="text-sm underline self-start pt-2"
            style={{ color: "var(--status-critical)", borderTop: "1px solid var(--gridline)" }}
          >
            Cancelar pedido
          </button>
        )
      ) : null}
    </div>
  );
}
