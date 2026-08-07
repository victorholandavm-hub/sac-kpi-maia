"use client";

import { useState } from "react";
import type { NpsDetractor } from "@/lib/kpi";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Botão + modal (mesmo padrão de ProductsModalButton.tsx) -- fica ao lado do
// percentual de detratores no NpsCard, só abrindo a lista de nome/contato
// quando clicado, em vez de ocupar espaço fixo no painel.
export function NpsDetractorsList({ data }: { data: NpsDetractor[] }) {
  const [open, setOpen] = useState(false);
  if (data.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap underline self-start"
        style={{ color: "var(--status-critical)", background: "color-mix(in srgb, var(--status-critical) 15%, var(--surface-1))" }}
      >
        Ver lista ({data.length})
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar lista de detratores"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-sm max-h-[65vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Clientes detratores (nota 1-2)
              </h3>
              <button
                aria-label="Fechar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
              {data.map((d) => (
                <div key={d.conversationId} className="flex items-center justify-between gap-3 py-2 flex-wrap">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {d.clientName ?? "Sem nome"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {d.clientPhone ?? "Sem telefone"} · {formatDateTimeBr(d.answeredAt)}
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                    style={{ background: "color-mix(in srgb, var(--status-critical) 20%, var(--surface-1))", color: "var(--status-critical)" }}
                  >
                    Nota {d.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
