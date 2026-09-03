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
            <div key={p.id} className="rounded-lg px-2.5 py-1.5 text-sm text-gray-800 dark:text-gray-100" style={{ background: "color-mix(in srgb, var(--status-critical) 6%, var(--surface-1))" }}>
              <p>{p.description}</p>
              <p className="text-xs mt-0.5 text-gray-400 dark:text-gray-500">
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
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
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
              className="text-xs rounded-lg px-3.5 py-2 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60"
              style={{ background: "var(--status-critical)" }}
            >
              Registrar problema
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setDescription("");
              }}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150"
            >
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 self-start">
          + registrar problema
        </button>
      )}
    </div>
  );
}
