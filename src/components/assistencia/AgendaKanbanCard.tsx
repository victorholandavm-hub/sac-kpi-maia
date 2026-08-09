"use client";

import { useState } from "react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
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
      style={{
        ...style,
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        opacity: isDragging ? 0.5 : 1,
      }}
      className="rounded-lg p-2.5 flex flex-col gap-1.5 relative touch-none"
    >
      <div {...listeners} {...attributes} className="flex flex-col gap-1.5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            #{item.ticketNumber}
          </span>
          <StatusBadge status={item.status} />
          {dateLabel ? (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-green) 35%, var(--surface-1))" }}
            >
              📅 {dateLabel}
              {item.scheduledTime ? ` ${item.scheduledTime.slice(0, 5)}` : ""}
            </span>
          ) : null}
        </div>
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded self-start"
          style={{
            color: "var(--text-primary)",
            background: `color-mix(in srgb, ${REQUEST_TYPE_COLORS[item.type] ?? "var(--text-secondary)"} 20%, var(--surface-1))`,
          }}
        >
          {REQUEST_TYPE_LABELS[item.type] ?? item.type}
        </span>
        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {item.clientName ?? "Sem nome de cliente"}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.shift ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {SHIFT_LABELS[item.shift] ?? item.shift}
            </span>
          ) : null}
          {item.rota ? (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${ROTA_COLORS[item.rota]} 35%, var(--surface-1))` }}
            >
              {ROTA_LABELS[item.rota]}
            </span>
          ) : null}
          {item.clientNeighborhood ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              📍 {item.clientNeighborhood}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: "1px solid var(--gridline)" }}>
        <Link href={`/assistencia/${item.id}`} className="text-xs underline" style={{ color: "var(--brand-green)" }}>
          Ver chamado
        </Link>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ color: "var(--text-muted)" }}
        >
          •••
        </button>
      </div>

      {menuOpen ? (
        <div
          className="absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-lg py-1 max-h-52 overflow-y-auto"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", minWidth: 160 }}
        >
          <span className="text-xs px-3 py-1 block" style={{ color: "var(--text-muted)" }}>
            Mover pra:
          </span>
          {assemblers.map((name) => (
            <button
              key={name}
              onClick={() => {
                setMenuOpen(false);
                onReassign(name);
              }}
              className="text-sm px-3 py-1.5 w-full text-left hover:opacity-80"
              style={{ color: "var(--text-primary)" }}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
