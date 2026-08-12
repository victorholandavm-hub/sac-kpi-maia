"use client";

import { useState } from "react";
import type { AgentStat, StoreBreakdownTicket } from "@/lib/kpi";
import { CategoryTicketsModal } from "./CategoryTicketsModal";

function formatMinutes(minutes: number) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}min`;
}

// Clique na linha abre o drill-down (mesmo modal genérico já usado pra
// categoria/loja/semana anterior) com os chamados pendentes ou de nota
// baixa daquele agente -- pra correção de rota rápida sem sair do painel.
export function AgentStatsTable({ data, ticketsByAgent }: { data: AgentStat[]; ticketsByAgent: Record<string, StoreBreakdownTicket[]> }) {
  const [selected, setSelected] = useState<AgentStat | null>(null);
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Desempenho por agente do SAC
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Tempo de resolução considera só chamados com a tag de status aplicada. 1ª resposta/SLA já
        considera horário comercial. Clique num agente pra ver os chamados pendentes ou com nota baixa.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem chamados atribuídos a agentes do SAC no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-1 pr-4 font-normal">Agente</th>
                <th className="py-1 pr-4 font-normal">Chamados</th>
                <th className="py-1 pr-4 font-normal">Resolvidos</th>
                <th className="py-1 pr-4 font-normal">Tempo médio de resolução</th>
                <th className="py-1 pr-4 font-normal">1ª resposta (média)</th>
                <th className="py-1 pr-4 font-normal">Dentro do SLA</th>
                <th className="py-1 pr-4 font-normal">Nota (NPS)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.agent}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer hover:opacity-80"
                  style={{ borderTop: "1px solid var(--gridline)" }}
                >
                  <td className="py-2 pr-4 underline" style={{ color: "var(--text-primary)" }}>
                    {row.agent}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.total}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.resolvedCount}
                    {row.total > 0 ? (
                      <span style={{ color: "var(--text-muted)" }}> ({Math.round((row.resolvedCount / row.total) * 100)}%)</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.avgResolutionHours !== null ? `${row.avgResolutionHours}h` : "—"}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.avgFirstResponseMinutes !== null ? formatMinutes(row.avgFirstResponseMinutes) : "—"}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.pctWithinSla !== null ? `${row.pctWithinSla}%` : "—"}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.avgNpsScore !== null ? (
                      <>
                        {row.avgNpsScore}/5{" "}
                        <span style={{ color: "var(--text-muted)" }}>({row.npsResponseCount})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <CategoryTicketsModal
          title={`Pendentes/nota baixa — ${selected.agent}`}
          totalCount={(ticketsByAgent[selected.agent] ?? []).length}
          tickets={ticketsByAgent[selected.agent] ?? []}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
