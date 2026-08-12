import type { StoreBreakdown } from "@/lib/kpi";
import { StoreCategoryDrilldown } from "./StoreCategoryDrilldown";
import { ALERT_SUGGESTIONS } from "@/lib/alertSuggestions";

// Só mostra o sinal quando o problema é concentrado o bastante pra valer um
// palpite automático -- loja com poucos chamados ou problema espalhado
// (baixo %) não tem sinal confiável.
const ALERT_MIN_PCT = 35;
const ALERT_MIN_TOTAL = 5;

function alertFor(row: StoreBreakdown): string | null {
  if (row.total < ALERT_MIN_TOTAL || row.topCategoryPct < ALERT_MIN_PCT) return null;
  return row.topCategoryTag ? (ALERT_SUGGESTIONS[row.topCategoryTag] ?? null) : null;
}

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
                <th className="py-1 pr-4 font-normal">Sinal</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const alert = alertFor(row);
                return (
                  <tr key={row.store} style={{ borderTop: "1px solid var(--gridline)" }}>
                    <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                      {row.store}
                    </td>
                    <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.total}
                    </td>
                    <td className="py-2 pr-4">
                      {row.topCategory ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            {row.topCategory} ({row.topCategoryPct}%)
                          </span>
                          <StoreCategoryDrilldown
                            store={row.store}
                            category={row.topCategory}
                            totalCount={row.topCategoryCount}
                            tickets={row.topCategoryTickets}
                          />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {alert ? (
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-full inline-block"
                          style={{ background: "color-mix(in srgb, var(--status-warning) 18%, var(--surface-1))", color: "var(--status-warning)" }}
                        >
                          {alert}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
