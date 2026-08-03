import { ROLE_LABELS, PEDIDO_ENCOMENDA_STATUS_LABELS } from "@/lib/assistenciaLabels";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import type { PedidoEncomendaEvent } from "@/lib/pedidosEncomenda";

function describeEvent(e: PedidoEncomendaEvent): string {
  const toLabel = e.toStatus ? PEDIDO_ENCOMENDA_STATUS_LABELS[e.toStatus] ?? e.toStatus : null;
  switch (e.eventType) {
    case "created":
      return "Pedido criado.";
    case "edited":
      return "Pedido editado pelo solicitante.";
    case "status_changed":
      return toLabel ? `Status alterado para "${toLabel}".` : "Status alterado.";
    case "carga_informada":
      return `Carga informada${toLabel ? ` · status "${toLabel}"` : ""}.`;
    case "nf_e_informada":
      return `NF-e informada${toLabel ? ` · status "${toLabel}"` : ""}.`;
    case "item_added":
      return "Item adicionado ao pedido.";
    case "note_added":
      return "Observação adicionada.";
    case "prazo_definido":
      return e.note ?? "Previsão de entrega atualizada.";
    case "fornecedor_changed":
      return "Fornecedor corrigido.";
    default:
      return e.eventType;
  }
}

export function PedidoEncomendaTimeline({ events }: { events: PedidoEncomendaEvent[] }) {
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
          {e.note && e.eventType !== "prazo_definido" ? (
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
              {e.note}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
