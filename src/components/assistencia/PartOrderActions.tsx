"use client";

import { useState } from "react";
import { updatePartOrderStatus, addPartOrderNote } from "@/app/assistencia/pecas-actions";
import { useQuickAction } from "./useQuickAction";
import { PART_ORDER_STATUS_LABELS } from "@/lib/assistenciaLabels";

const NEXT_STATUSES: Record<string, string[]> = {
  aguardando_peca: ["peca_recebida"],
  peca_recebida: ["enviada_ao_cliente"],
  enviada_ao_cliente: ["encerrado"],
  encerrado: [],
};

export function PartOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const [note, setNote] = useState("");

  const nextStatuses = NEXT_STATUSES[status] ?? [];

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() =>
                run(() => updatePartOrderStatus(orderId, s), `Status atualizado para ${PART_ORDER_STATUS_LABELS[s] ?? s}.`)
              }
              className="text-sm rounded px-3 py-2 border disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              Marcar como {PART_ORDER_STATUS_LABELS[s] ?? s}
            </button>
          ))}
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
              await addPartOrderNote(orderId, note);
              setNote("");
            }, "Nota adicionada.")
          }
          className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Adicionar nota
        </button>
      </div>
    </div>
  );
}
