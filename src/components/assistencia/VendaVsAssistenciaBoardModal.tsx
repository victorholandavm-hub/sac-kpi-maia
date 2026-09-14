"use client";

import { useState } from "react";
import type { ReportRowItem } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { TicketResumoModal } from "./TicketResumoModal";

// Board por tipo -- pedido do Victor 14/09/2026: "quando eu clicar no
// percentual, quero que abra uma lista com as notificações, mas basta o
// titulo... e aí quando eu clicar em uma delas, abre o modal com o resumo
// da notificação. Alem disso... pode abrir com colunas: 'troca com
// recolhimento', 'entrega de peça'...". Uma coluna por tipo evita repetir
// o mesmo título dezenas de vezes numa lista só (uma loja com 40 chamados
// de "Troca de peça" viraria 40 linhas idênticas numa lista plana) -- o
// próprio cabeçalho da coluna já diz o tipo, cada card dentro só precisa
// do que diferencia UM chamado do outro (cliente + data). Clicar num card
// abre o "resumo" (TicketResumoModal.tsx), nível mais fundo.
function groupByType(tickets: ReportRowItem[]): { type: string; label: string; tickets: ReportRowItem[] }[] {
  const byType = new Map<string, ReportRowItem[]>();
  for (const t of tickets) {
    const lista = byType.get(t.type) ?? [];
    lista.push(t);
    byType.set(t.type, lista);
  }
  return [...byType.entries()]
    .map(([type, list]) => ({ type, label: REQUEST_TYPE_LABELS[type] ?? type, tickets: list }))
    .sort((a, b) => b.tickets.length - a.tickets.length);
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function VendaVsAssistenciaBoardModal({
  storeName,
  tickets,
  onClose,
}: {
  storeName: string;
  tickets: ReportRowItem[];
  onClose: () => void;
}) {
  const [selectedTicket, setSelectedTicket] = useState<ReportRowItem | null>(null);
  const columns = groupByType(tickets);

  return (
    <>
      <button aria-label="Fechar" onClick={onClose} className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-4xl max-h-[80vh] flex flex-col rounded-lg border shadow-lg"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4 p-4 pb-3 border-b" style={{ borderColor: "var(--gridline)" }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Assistência técnica — {storeName}
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {tickets.length} chamado{tickets.length === 1 ? "" : "s"} no período, por tipo. Clique num card pra ver o resumo.
            </p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded shrink-0" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>

        {tickets.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nenhum chamado no período.
          </p>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-3">
            {columns.map((col) => (
              <div key={col.type} className="shrink-0 w-60 flex flex-col rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--gridline)" }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {col.label}
                  </span>
                  <span
                    className="text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                    style={{ background: "var(--brand-green-soft)", color: "var(--text-primary)" }}
                  >
                    {col.tickets.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-2 overflow-y-auto">
                  {col.tickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTicket(t)}
                      className="text-left rounded-md border px-2.5 py-2 text-xs transition-colors hover:opacity-80"
                      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                          #{t.ticketNumber}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>{formatShortDate(t.createdAt)}</span>
                      </div>
                      <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {t.clientName ?? "Sem nome"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTicket ? <TicketResumoModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} /> : null}
    </>
  );
}
