"use client";

import { useState } from "react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS, SHIFT_LABELS, DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";
import { ROTA_LABELS, ROTA_COLORS } from "@/lib/rotas";
import { StatusBadge } from "./StatusBadge";
import { agendaEffectiveDate, type ServiceRequestSummary } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
}

// Cartão arrastável (dnd-kit) + "..." com lista simples de montador, pra
// quem preferir não arrastar (teclado, trackpad ruim, etc.) -- ação real
// (redireciona um técnico de verdade), então sempre tem um jeito sem
// depender do gesto de arrastar dar certo.
export function AgendaKanbanCard({
  item,
  assemblers,
  onReassign,
}: {
  item: ServiceRequestSummary;
  assemblers: string[];
  onReassign: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const dateLabel = formatDateOnly(agendaEffectiveDate(item));

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
      className="rounded-lg border border-gray-200 bg-white p-2.5 flex flex-col gap-1.5 relative touch-none shadow-sm"
    >
      <div {...listeners} {...attributes} className="flex flex-col gap-1.5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-gray-400">#{item.ticketNumber}</span>
          <StatusBadge status={item.status} />
          {dateLabel ? (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: "color-mix(in srgb, var(--brand-green) 70%, black)", background: "color-mix(in srgb, var(--brand-green) 14%, white)" }}
            >
              📅 {dateLabel}
              {item.scheduledTime ? ` ${item.scheduledTime.slice(0, 5)}` : ""}
            </span>
          ) : null}
        </div>
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full self-start whitespace-nowrap"
          style={{
            color: `color-mix(in srgb, ${REQUEST_TYPE_COLORS[item.type] ?? "#6B7280"} 70%, black)`,
            background: `color-mix(in srgb, ${REQUEST_TYPE_COLORS[item.type] ?? "#6B7280"} 14%, white)`,
          }}
        >
          {REQUEST_TYPE_LABELS[item.type] ?? item.type}
        </span>
        <span className="text-sm font-medium truncate text-gray-800">{item.clientName ?? "Sem nome de cliente"}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.shift ? <span className="text-xs text-gray-400">{SHIFT_LABELS[item.shift] ?? item.shift}</span> : null}
          {item.urgent ? (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "var(--status-critical)" }}>
              URGENTE
            </span>
          ) : null}
          {/* Rota é só de visita de motorista -- não existe pra montagem/
              desmontagem/vistoria/troca de peça, mesmo com dado velho. */}
          {item.rota && (DELIVERY_REQUEST_TYPES as readonly string[]).includes(item.type) ? (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: `color-mix(in srgb, ${ROTA_COLORS[item.rota]} 70%, black)`, background: `color-mix(in srgb, ${ROTA_COLORS[item.rota]} 14%, white)` }}
            >
              {ROTA_LABELS[item.rota]}
            </span>
          ) : null}
          {item.clientNeighborhood ? <span className="text-xs text-gray-400">📍 {item.clientNeighborhood}</span> : null}
        </div>
      </div>

      {/* "Ver chamado" continua um link à parte (não o card inteiro) --
          diferente das listagens em tabela/linha (AssistenciaQueueGroup,
          EntregasKanbanHoje), aqui o card inteiro já tem os listeners de
          arrastar (dnd-kit, ver acima); embrulhar tudo num <Link> junto
          ia disputar o mesmo gesto de clique com o de arrastar. */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
        <Link href={`/assistencia/${item.id}`} className="text-xs font-medium hover:underline" style={{ color: "#1B5E3C" }}>
          Ver chamado
        </Link>
        <button onClick={() => setMenuOpen((v) => !v)} className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-600">
          •••
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-52 overflow-y-auto" style={{ minWidth: 160 }}>
          <span className="text-xs px-3 py-1 block text-gray-400">Mover pra:</span>
          {assemblers.map((name) => (
            <button
              key={name}
              onClick={() => {
                setMenuOpen(false);
                onReassign(name);
              }}
              className="text-sm px-3 py-1.5 w-full text-left text-gray-800 hover:bg-gray-50 transition-colors duration-150"
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
