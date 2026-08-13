"use client";

import type { StoreBreakdownTicket, AgentDrilldownTicket } from "@/lib/kpi";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Uma linha de chamado -- mesmo desenho de CategoryTicketsModal, com um
// selo opcional (usado pra mostrar a nota da avaliação negativa).
function TicketRow({ t, badge }: { t: StoreBreakdownTicket; badge?: string }) {
  return (
    <div className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {t.clientName ?? "Sem nome"}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {badge ? (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              {badge}
            </span>
          ) : null}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {formatDateTimeBr(t.openedAt)}
          </span>
        </div>
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
  );
}

// Aberto ao clicar no nome do agente em AgentStatsTable -- correção de rota
// rápida: em vez de sair caçando na fila geral, já mostra só o que é dessa
// pessoa (pendentes em aberto + avaliações negativas) no período filtrado.
export function AgentDrilldownModal({
  agent,
  pending,
  negative,
  onClose,
}: {
  agent: string;
  pending: StoreBreakdownTicket[];
  negative: AgentDrilldownTicket[];
  onClose: () => void;
}) {
  return (
    <>
      <button
        aria-label="Fechar detalhe do agente"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-lg max-h-[80vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {agent}
          </h3>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ color: "var(--text-muted)" }}
          >
            Fechar
          </button>
        </div>

        <div className="flex flex-col gap-1 mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--brand-orange)" }}>
            Chamados pendentes ({pending.length})
          </h4>
          {pending.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nenhum chamado em aberto dessa pessoa no período.
            </p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
              {pending.map((t) => (
                <TicketRow key={t.conversationId} t={t} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--status-critical)" }}>
            Avaliações negativas ({negative.length})
          </h4>
          {negative.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nenhuma avaliação 1-2 dessa pessoa no período.
            </p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
              {negative.map((t) => (
                <TicketRow key={t.conversationId} t={t} badge={t.npsScore !== null ? `Nota ${t.npsScore}` : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
