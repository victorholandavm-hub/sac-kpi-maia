import type { StoreBreakdown } from "@/lib/kpi";

export function StoreBreakdownTable({ data }: { data: StoreBreakdown[] }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Chamados por loja e problema mais comum
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Ordenado pelo total de chamados.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-1 pr-4 font-normal">Loja</th>
                <th className="py-1 pr-4 font-normal">Total</th>
                <th className="py-1 pr-4 font-normal">Problema mais comum</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.store} style={{ borderTop: "1px solid var(--gridline)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                    {row.store}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.total}
                  </td>
                  <td className="py-2 pr-4">
                    {row.topCategory ? `${row.topCategory} (${row.topCategoryPct}%)` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
