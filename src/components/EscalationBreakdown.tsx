import type { EscalationTargetStat } from "@/lib/kpi";
import { escalationTargetLabel } from "@/lib/labels";

function formatMinutes(minutes: number) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}min`;
}

export function EscalationBreakdown({ data }: { data: EscalationTargetStat[] }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Tempo de espera por quem foi consultado (lido por IA)
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Detectado automaticamente no texto das conversas — quando o atendente avisa que vai
        verificar com alguém e depois retorna com a resposta.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem ciclos de consulta concluídos ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-1 pr-4 font-normal">Consultado</th>
                <th className="py-1 pr-4 font-normal">Ocorrências</th>
                <th className="py-1 pr-4 font-normal">Tempo médio de espera</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.target} style={{ borderTop: "1px solid var(--gridline)" }}>
                  <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                    {escalationTargetLabel(row.target)}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.count}
                  </td>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.avgWaitMinutes !== null ? formatMinutes(row.avgWaitMinutes) : "—"}
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
