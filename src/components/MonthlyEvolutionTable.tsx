export type MonthlyEvolutionRow = {
  monthKey: string;
  monthLabel: string;
  totalChamados: number;
  totalVendas: number;
  pct: number | null;
};

// Tabela de evolução mensal (chamados x vendas x %) -- pedido do Victor
// 18/09/2026, primeiro pra assistência e depois pro SAC ("faltou o da aba
// do sac"). Componente compartilhado pelas duas telas -- só troca o título/
// subtítulo e a fonte dos dados (getAssistenciaMonthlyEvolution em
// kpiAssistencia.ts / getKpiMonthlyEvolution em kpi.ts), o formato da linha
// é idêntico nos dois casos.
export function MonthlyEvolutionTable({
  rows,
  title = "Evolução mensal",
  subtitle = "Total de chamados, total de vendas e o percentual entre os dois, mês a mês.",
}: {
  rows: MonthlyEvolutionRow[];
  title?: string;
  subtitle?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {subtitle}
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
