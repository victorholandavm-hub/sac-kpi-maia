"use client";

import { useState } from "react";
import { setDriverName } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

export function DriverNameField({
  requestId,
  value,
  drivers,
}: {
  requestId: string;
  value: string | null;
  drivers: string[];
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(value ?? "");

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nome do motorista
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {value ?? "Não definido"}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            {value ? "editar" : "definir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Nome do motorista
      </span>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          list={`drivers-${requestId}`}
          autoFocus
        />
        <datalist id={`drivers-${requestId}`}>
          {drivers.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <button
          disabled={pending || !name.trim()}
          onClick={() =>
            run(async () => {
              await setDriverName(requestId, name);
              setEditing(false);
            }, "Motorista atualizado.")
          }
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setName(value ?? "");
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
