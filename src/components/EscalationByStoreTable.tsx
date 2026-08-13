import type { EscalationStoreStat } from "@/lib/kpi";

function formatMinutes(minutes: number) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}min`;
}

// Meta definida pelo usuário -- sem lugar melhor pra guardar isso hoje (não
// é dado do GHL, é decisão de negócio), mesmo padrão do NPS_INDEX_TARGET em
// NpsCard.tsx. Acima disso a loja "estourou" o tempo aceitável de retorno.
const WAIT_ALERT_MINUTES = 240; // 4h

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
        medido pelo texto real das conversas. Ordenado das mais lentas para as mais rápidas. Em
        vermelho: acima de {formatMinutes(WAIT_ALERT_MINUTES)} de espera média.
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
              {data.map((row) => {
                const blown = row.avgWaitMinutes !== null && row.avgWaitMinutes > WAIT_ALERT_MINUTES;
                return (
                  <tr
                    key={row.store}
                    style={{
                      borderTop: "1px solid var(--gridline)",
                      background: blown ? "color-mix(in srgb, var(--status-critical) 12%, var(--surface-1))" : undefined,
                    }}
                  >
                    <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                      {row.store}
                    </td>
                    <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.count}
                    </td>
                    <td
                      className="py-2 pr-4"
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: blown ? 700 : undefined,
                        color: blown ? "var(--status-critical)" : undefined,
                      }}
                    >
                      {row.avgWaitMinutes !== null ? formatMinutes(row.avgWaitMinutes) : "—"}
                      {blown ? " ⚠" : ""}
                    </td>
                    <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.pendingCount}
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
