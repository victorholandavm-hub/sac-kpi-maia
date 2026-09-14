"use client";

import type { ReportRowItem } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// "Resumo da notificação" -- pedido do Victor 14/09/2026: clicar num
// chamado dentro do board de "Vendas x Assistência técnica" (ver
// VendaVsAssistenciaBoardModal.tsx) abre isso, um nível mais fundo que a
// lista. Mesmos campos que já existem em ReportRowItem -- sem chamada
// nova ao banco, sem link pro chamado de verdade (mesmo motivo de
// AssistenciaTicketsModal.tsx: quem vê /kpis-assistencia pode ter entrado
// só com a senha de dashboard, não necessariamente logado como
// assistência/admin/SAC, então um link cairia no login à toa).
export function TicketResumoModal({ ticket, onClose }: { ticket: ReportRowItem; onClose: () => void }) {
  return (
    <>
      <button
        aria-label="Fechar resumo da notificação"
        onClick={onClose}
        className="fixed inset-0 z-[60]"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[15vh] z-[70] mx-auto max-w-sm rounded-lg border p-4 shadow-lg"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              #{ticket.ticketNumber}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
        <dl className="flex flex-col gap-2.5 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Tipo
            </dt>
            <dd style={{ color: "var(--text-primary)" }}>{REQUEST_TYPE_LABELS[ticket.type] ?? ticket.type}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Cliente
            </dt>
            <dd style={{ color: "var(--text-primary)" }}>{ticket.clientName ?? "Sem nome"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Loja
            </dt>
            <dd style={{ color: "var(--text-primary)" }}>{ticket.storeName}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Aberto em
            </dt>
            <dd style={{ color: "var(--text-primary)" }}>{formatDateTimeBr(ticket.createdAt)}</dd>
          </div>
          {ticket.productSummary ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Produto
              </dt>
              <dd style={{ color: "var(--text-primary)" }}>📦 {ticket.productSummary}</dd>
            </div>
          ) : null}
          {ticket.reason ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Problema
              </dt>
              <dd style={{ color: "var(--text-secondary)" }}>{ticket.reason}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </>
  );
}
