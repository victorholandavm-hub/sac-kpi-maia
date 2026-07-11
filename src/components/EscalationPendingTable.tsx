import type { EscalationRow } from "@/lib/kpi";
import { storeLabel, escalationTargetLabel } from "@/lib/labels";

export function EscalationPendingTable({ data }: { data: EscalationRow[] }) {
  const pending = data
    .filter((r) => r.wait_minutes === null && r.waiting_hours_so_far !== null)
    .sort((a, b) => (b.waiting_hours_so_far ?? 0) - (a.waiting_hours_so_far ?? 0))
    .slice(0, 15);

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Ainda esperando retorno (detectado por IA)
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Casos em que o atendente disse que ia verificar algo e ainda não voltou com a resposta.
      </p>
      {pending.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum ciclo de consulta em aberto.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-1 py-2"
              style={{ borderTop: "1px solid var(--gridline)" }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>{escalationTargetLabel(row.target)}</strong>
                  {row.store_tag ? ` · ${storeLabel(row.store_tag)}` : ""}
                </span>
                <span
                  className="text-xs whitespace-nowrap"
                  style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
                >
                  esperando há {Math.round(row.waiting_hours_so_far ?? 0)}h
                </span>
              </div>
              {row.ask_excerpt ? (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  &ldquo;{row.ask_excerpt}&rdquo;
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
