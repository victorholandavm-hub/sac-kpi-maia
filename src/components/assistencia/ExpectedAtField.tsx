"use client";

import { useState } from "react";
import { setExpectedAt } from "@/app/assistencia/pecas-actions";
import { useQuickAction } from "./useQuickAction";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function ExpectedAtField({ orderId, expectedAt }: { orderId: string; expectedAt: string | null }) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(expectedAt ?? "");

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Prazo esperado (SLA)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {expectedAt ? formatDateOnly(expectedAt) : "Não definido"}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Prazo esperado (SLA)
      </span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <button
          disabled={pending || !date}
          onClick={() =>
            run(async () => {
              await setExpectedAt(orderId, date);
              setEditing(false);
            }, "Prazo esperado atualizado.")
          }
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setDate(expectedAt ?? "");
            setEditing(false);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
