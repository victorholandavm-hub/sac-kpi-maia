"use client";

import { useState } from "react";
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
    case "status_reverted":
      return toLabel ? `Mudança de status desfeita — voltou para "${toLabel}".` : "Mudança de status desfeita.";
    default:
      return e.eventType;
  }
}

// "Manual" = observação escrita por alguém de próprio punho -- o resto
// (criado, status mudou, carga/NF-e/fornecedor informado) é o sistema
// registrando uma transição.
function isManual(e: PedidoEncomendaEvent): boolean {
  return e.eventType === "note_added" || e.eventType === "edited";
}

export function PedidoEncomendaTimeline({ events }: { events: PedidoEncomendaEvent[] }) {
  const [onlyManual, setOnlyManual] = useState(false);
  const manualCount = events.filter(isManual).length;
  const shown = onlyManual ? events.filter(isManual) : events;

  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Sem eventos ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {manualCount > 0 ? (
        <button
          onClick={() => setOnlyManual((v) => !v)}
          className="text-xs font-medium px-2.5 py-1 rounded-full border self-start"
          style={
            onlyManual
              ? { background: "var(--brand-green)", color: "var(--brand-green-ink)", borderColor: "var(--brand-green)" }
              : { borderColor: "var(--border)", color: "var(--text-secondary)" }
          }
        >
          {onlyManual ? `✓ Só observações (${manualCount})` : `Mostrar só observações (${manualCount})`}
        </button>
      ) : null}

      <ul className="flex flex-col">
        {shown.map((e, i) => (
          <li key={e.id} className="flex gap-3">
            {/* Bolinha + linha vertical conectando ao próximo evento -- último
                item não tem linha embaixo (nada mais pra conectar). */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: "var(--brand-green)" }} />
              {i < shown.length - 1 ? <div className="w-px flex-1" style={{ background: "var(--gridline)" }} /> : null}
            </div>
            <div className="flex flex-col gap-0.5 pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {describeEvent(e)}
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{e.actorName}</strong> ({ROLE_LABELS[e.actorRole] ?? e.actorRole}) ·{" "}
                {formatDateTimeBr(e.createdAt)}
              </span>
              {e.note && e.eventType !== "prazo_definido" ? (
                <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                  {e.note}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
