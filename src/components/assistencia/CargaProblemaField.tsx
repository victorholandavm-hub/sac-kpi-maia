"use client";

import { useState } from "react";
import { addCargaProblemaAction } from "@/app/assistencia/cargas-actions";
import { useQuickAction } from "./useQuickAction";
import type { CargaProblema } from "@/lib/cargas";
import { formatDateTimeBr } from "@/lib/formatDateTime";

export function CargaProblemaField({ cargaRowId, problemas }: { cargaRowId: string; problemas: CargaProblema[] }) {
  const { pending, run } = useQuickAction();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");

  return (
    <div className="flex flex-col gap-2">
      {problemas.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--status-critical)" }}>
            {problemas.length} problema{problemas.length === 1 ? "" : "s"} registrado{problemas.length === 1 ? "" : "s"}
          </span>
          {problemas.map((p) => (
            <div
              key={p.id}
              className="rounded px-2.5 py-1.5 text-sm"
              style={{ background: "color-mix(in srgb, var(--status-critical) 8%, var(--surface-1))", color: "var(--text-primary)" }}
            >
              <p>{p.description}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {p.reportedByName} · {formatDateTimeBr(p.createdAt)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="O que aconteceu com esse pedido nessa carga…"
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              disabled={pending || !description.trim()}
              onClick={() =>
                run(async () => {
                  await addCargaProblemaAction(cargaRowId, description);
                  setDescription("");
                  setAdding(false);
                }, "Problema registrado.")
              }
              className="text-xs rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              Registrar problema
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setDescription("");
              }}
              className="text-xs underline"
              style={{ color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs underline self-start" style={{ color: "var(--text-secondary)" }}>
          + registrar problema
        </button>
      )}
    </div>
  );
}
