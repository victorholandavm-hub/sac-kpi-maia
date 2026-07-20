import type { EscalationStoreStat } from "@/lib/kpi";

function formatMinutes(minutes: number) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}min`;
}

export function EscalationByStoreTable({ data }: { data: EscalationStoreStat[] }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Lojas mais lentas para responder o SAC (lido por IA)
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Tempo médio entre o SAC avisar que vai consultar a loja/gerência e a loja de fato responder,
        medido pelo texto real das conversas. Ordenado das mais lentas para as mais rápidas.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem ciclos de consulta à loja detectados ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-1 pr-4 font-normal">Loja</th>
                <th className="py-1 pr-4 font-normal">Ocorrências</th>
                <th className="py-1 pr-4 font-normal">Tempo médio de espera</th>
                <th className="py-1 pr-4 font-normal">Pendentes agora</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.store} style={{ borderTop: "1px solid var(--gridline)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                    {row.store}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.count}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.avgWaitMinutes !== null ? formatMinutes(row.avgWaitMinutes) : "—"}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.pendingCount}
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
