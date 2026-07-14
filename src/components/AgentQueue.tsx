import type { AgentQueueGroup } from "@/lib/kpi";
import { storeLabel, categoryLabel } from "@/lib/labels";

const URGENCY_COLOR: Record<string, string> = {
  alta: "var(--status-critical)",
  media: "var(--status-warning)",
  baixa: "var(--status-good)",
};

function UrgencyDot({ urgency }: { urgency: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: URGENCY_COLOR[urgency] ?? "var(--text-muted)" }}
    />
  );
}

export function AgentQueue({ data }: { data: AgentQueueGroup[] }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Fila por atendente
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Chamados em aberto de cada atendente, ordenados por urgência e tempo parado.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum chamado em aberto — parabéns!
        </p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((group) => (
            <div key={group.agent} className="rounded-md" style={{ border: "1px solid var(--gridline)" }}>
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: "1px solid var(--gridline)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {group.agent}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  {group.tickets.length}
                </span>
              </div>
              <div className="flex flex-col max-h-80 overflow-y-auto">
                {group.tickets.map((t) => (
                  <div
                    key={t.conversation_id}
                    className="px-3 py-2 flex flex-col gap-0.5"
                    style={{ borderBottom: "1px solid var(--gridline)" }}
                  >
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <UrgencyDot urgency={t.urgency} />
                      <span>{t.store_tag ? storeLabel(t.store_tag) : "Loja não identificada"}</span>
                      {t.category ? <span>· {categoryLabel(t.category)}</span> : null}
                      <span className="ml-auto" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {Math.round(t.aberto_ha_horas)}h
                      </span>
                    </div>
                    {t.summary_ai ? (
                      <p className="text-xs truncate" style={{ color: "var(--text-primary)" }} title={t.summary_ai}>
                        {t.summary_ai}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
