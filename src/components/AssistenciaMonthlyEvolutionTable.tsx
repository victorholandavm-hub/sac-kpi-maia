import type { AssistenciaMonthlyEvolutionRow } from "@/lib/kpiAssistencia";

// Tabela de evolução mensal do KPI "Total de chamados de assistência" --
// pedido do Victor 18/09/2026. Sempre os últimos N meses (ver
// getAssistenciaMonthlyEvolution), independente do período escolhido no
// RangePicker da tela -- é uma tendência ao longo do tempo, não um recorte
// único. Mais recente por último (cronológico) -- lê como um gráfico de
// evolução, não como um ranking.
export function AssistenciaMonthlyEvolutionTable({ rows }: { rows: AssistenciaMonthlyEvolutionRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Evolução mensal
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Total de chamados de assistência, total de vendas e o percentual entre os dois, mês a mês.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: "480px" }}>
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
              {["Mês/Ano", "Total de chamados", "Total de vendas", "%"].map((h, idx) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap ${idx === 0 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.monthKey}>
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">{row.monthLabel}</td>
                <td className="px-4 py-2.5 text-right text-gray-800 dark:text-gray-100">{row.totalChamados.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{row.totalVendas.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                  {row.pct !== null ? `${row.pct.toLocaleString("pt-BR")}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
