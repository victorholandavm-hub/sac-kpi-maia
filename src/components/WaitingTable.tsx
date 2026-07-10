import type { WaitingRow } from "@/lib/kpi";
import { storeLabel, blockingLabel } from "@/lib/labels";

export function WaitingTable({ data }: { data: WaitingRow[] }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Chamados esperando resposta externa
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        SAC já fez sua parte e está travado esperando loja/operação responder.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum chamado marcado como aguardando resposta externa.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((row) => (
            <div
              key={row.conversation_id}
              className="flex items-center justify-between gap-2 py-2 flex-wrap"
              style={{ borderTop: "1px solid var(--gridline)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                <span
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mr-2"
                  style={{ color: "var(--brand-orange)", border: "1px solid var(--brand-orange)" }}
                >
                  {blockingLabel(row.blocking_tag)}
                </span>
                {row.store_tag ? storeLabel(row.store_tag) : "Loja não identificada"}
              </span>
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
              >
                esperando há {Math.round(row.aguardando_ha_horas)}h
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
