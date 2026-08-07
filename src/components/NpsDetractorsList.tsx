import type { NpsDetractor } from "@/lib/kpi";
import { formatDateTimeBr } from "@/lib/formatDateTime";

export function NpsDetractorsList({ data }: { data: NpsDetractor[] }) {
  if (data.length === 0) return null;

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--status-critical)" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Clientes detratores (nota 1-2)
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {data.length} no período
        </span>
      </div>
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
        {data.map((d) => (
          <div key={d.conversationId} className="flex items-center justify-between gap-3 py-2 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {d.clientName ?? "Sem nome"}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {d.clientPhone ?? "Sem telefone"} · {formatDateTimeBr(d.answeredAt)}
              </span>
            </div>
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
              style={{ background: "color-mix(in srgb, var(--status-critical) 20%, var(--surface-1))", color: "var(--status-critical)" }}
            >
              Nota {d.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
