"use client";

import { useState } from "react";
import { setMontadorInstruction } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

export function MontadorInstructionField({ requestId, value }: { requestId: string; value: string | null }) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(value ?? "");

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Instrução pro montador (visível pra ele)
        </span>
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {value || "Nenhuma"}
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
        Instrução pro montador (visível pra ele)
      </span>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Ex: cliente prefere que chegue depois das 14h, subir móvel pelo elevador de serviço…"
        className="rounded border px-2 py-1.5 text-sm"
        style={{ borderColor: "var(--border)" }}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            run(async () => {
              await setMontadorInstruction(requestId, note);
              setEditing(false);
            }, "Instrução salva.")
          }
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setNote(value ?? "");
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
