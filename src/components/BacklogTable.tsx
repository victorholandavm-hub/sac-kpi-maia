import type { AttentionRow } from "@/lib/kpi";
import { categoryLabel, storeLabel, productLabel } from "@/lib/labels";

const URGENCY_COLOR: Record<string, string> = {
  alta: "var(--status-critical)",
  media: "var(--status-warning)",
  baixa: "var(--status-good)",
};

const URGENCY_TEXT: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

function UrgencyBadge({ urgency }: { urgency: string }) {
  const color = URGENCY_COLOR[urgency] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color, border: `1px solid ${color}` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {URGENCY_TEXT[urgency] ?? urgency}
    </span>
  );
}

export function BacklogTable({ data }: { data: AttentionRow[] }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Chamados que precisam de atenção
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Ordenados por urgência e tempo em aberto (mais antigo primeiro).
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum chamado em aberto — parabéns!
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((row) => (
            <div
              key={row.conversation_id}
              className="flex flex-col gap-1 py-2"
              style={{ borderTop: "1px solid var(--gridline)" }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <UrgencyBadge urgency={row.urgency} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {row.store_tag ? storeLabel(row.store_tag) : "Loja não identificada"}
                    {row.category ? ` · ${categoryLabel(row.category)}` : ""}
                    {row.product ? ` · ${productLabel(row.product)}` : ""}
                  </span>
                </div>
                <span
                  className="text-xs whitespace-nowrap"
                  style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
                >
                  aberto há {Math.round(row.aberto_ha_horas)}h
                </span>
              </div>
              {row.summary_ai ? (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {row.summary_ai}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
