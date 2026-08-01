import { ROLE_LABELS, PEDIDO_FORNECEDOR_STATUS_LABELS } from "@/lib/assistenciaLabels";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import type { PedidoFornecedorEvent } from "@/lib/pedidosFornecedor";

function describeEvent(e: PedidoFornecedorEvent): string {
  const toLabel = e.toStatus ? PEDIDO_FORNECEDOR_STATUS_LABELS[e.toStatus] ?? e.toStatus : null;
  switch (e.eventType) {
    case "created":
      return "Pedido criado.";
    case "status_changed":
      return toLabel ? `Status alterado para "${toLabel}".` : "Status alterado.";
    case "note_added":
      return "Observação adicionada.";
    case "expected_at_changed":
      return e.note ?? "Previsão de chegada atualizada.";
    default:
      return e.eventType;
  }
}

export function PedidoFornecedorTimeline({ events }: { events: PedidoFornecedorEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Sem eventos ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {describeEvent(e)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {e.actorName} ({ROLE_LABELS[e.actorRole] ?? e.actorRole}) · {formatDateTimeBr(e.createdAt)}
            </span>
          </div>
          {e.note && e.eventType !== "expected_at_changed" ? (
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
              {e.note}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
