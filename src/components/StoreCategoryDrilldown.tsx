"use client";

import { useState } from "react";
import type { StoreBreakdownTicket } from "@/lib/kpi";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Mesmo padrão de NpsDetractorsList.tsx -- botão + modal artesanal, só que
// aqui pra abrir o que está por trás do "problema mais comum" de uma loja.
// Categorias tipo "Dúvida" são um rótulo vago por si só; o resumo de IA por
// conversa (summaryAi) é o que de fato conta do que se trata.
export function StoreCategoryDrilldown({
  store,
  category,
  totalCount,
  tickets,
}: {
  store: string;
  category: string;
  totalCount: number;
  tickets: StoreBreakdownTicket[];
}) {
  const [open, setOpen] = useState(false);
  if (tickets.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline whitespace-nowrap"
        style={{ color: "var(--brand-green)" }}
      >
        Ver chamados
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar lista de chamados"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4 mb-1">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {category} · {store}
              </h3>
              <button
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              {tickets.length < totalCount
                ? `Mostrando os ${tickets.length} mais recentes de ${totalCount} chamados.`
                : `${tickets.length} chamado${tickets.length === 1 ? "" : "s"}.`}
            </p>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
              {tickets.map((t) => (
                <div key={t.conversationId} className="flex flex-col gap-1 py-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {t.clientName ?? "Sem nome"}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                      {formatDateTimeBr(t.openedAt)}
                    </span>
                  </div>
                  {t.clientPhone ? (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {t.clientPhone}
                    </span>
                  ) : null}
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {t.summaryAi ?? "Sem resumo disponível pra essa conversa."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
