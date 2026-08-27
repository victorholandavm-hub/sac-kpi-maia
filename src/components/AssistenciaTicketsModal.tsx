"use client";

import type { ReportRowItem } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./assistencia/StatusBadge";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Mesma estrutura visual de CategoryTicketsModal.tsx (aba "Geral" do
// painel de KPIs), mas pra chamado de assistência (ReportRowItem,
// serviceRequests.ts) em vez de conversa do GHL (StoreBreakdownTicket,
// GHL-shaped -- não serve aqui). Sem link pro chamado: quem tá vendo esse
// painel entrou com a senha de dashboard (requireDashboardAuth), não
// necessariamente logado como assistência/admin/SAC -- um link cairia no
// login de /assistencia sem necessidade.
export function AssistenciaTicketsModal({
  title,
  totalCount,
  tickets,
  onClose,
}: {
  title: string;
  totalCount: number;
  tickets: ReportRowItem[];
  onClose: () => void;
}) {
  return (
    <>
      <button
        aria-label="Fechar lista de chamados"
        onClick={onClose}
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
            {title}
          </h3>
          <button aria-label="Fechar" onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
            Fechar
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {tickets.length === 0
            ? "Nenhum chamado encontrado pra esse período."
            : `${tickets.length} de ${totalCount} chamado${totalCount === 1 ? "" : "s"}.`}
        </p>
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
          {tickets.map((t) => (
            <div key={t.id} className="flex flex-col gap-1 py-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                    #{t.ticketNumber}
                  </span>
                  <StatusBadge status={t.status} />
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {t.clientName ?? "Sem nome"}
                  </span>
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                  {formatDateTimeBr(t.createdAt)}
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {REQUEST_TYPE_LABELS[t.type] ?? t.type} · {t.storeName}
              </span>
              {t.reason ? (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {t.reason}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
