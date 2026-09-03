"use client";

import { useState } from "react";
import { formatDateTimeBr } from "@/lib/formatDateTime";

export type HistoryEvent = {
  id: string;
  eventType: string;
  note: string | null;
  createdAt: string;
  actorName: string | null;
  actionText: string;
};

// "Manual" = alguém escreveu algo de próprio punho (nota, correção de
// dados) -- o resto (criou, assumiu, mudou status, aprovou/recusou prazo)
// é o sistema registrando uma transição, não um texto livre do operador.
function isManual(event: HistoryEvent): boolean {
  return event.eventType === "note_added" || event.eventType === "edited" || !!event.note?.trim();
}

export function RequestHistoryTimeline({ events }: { events: HistoryEvent[] }) {
  const [onlyManual, setOnlyManual] = useState(false);
  const manualCount = events.filter(isManual).length;
  const shown = onlyManual ? events.filter(isManual) : events;

  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: "#9CA3AF" }}>
        Sem eventos registrados.
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
              ? { background: "#1B5E3C", color: "#ffffff", borderColor: "#1B5E3C" }
              : { borderColor: "var(--border)", color: "var(--text-secondary)" }
          }
        >
          {onlyManual ? `✓ Só notas manuais (${manualCount})` : `Mostrar só notas manuais (${manualCount})`}
        </button>
      ) : null}

      <ul className="flex flex-col">
        {shown.map((event, i) => (
          <li key={event.id} className="flex gap-3">
            {/* Bolinha + linha vertical conectando ao próximo evento --
                último item não tem linha embaixo. */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: "#1B5E3C" }} />
              {i < shown.length - 1 ? <div className="w-px flex-1" style={{ background: "var(--gridline)" }} /> : null}
            </div>
            <div className="flex flex-col gap-0.5 pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <strong style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{event.actorName ?? "Alguém"}</strong>{" "}
                  {event.actionText}
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {formatDateTimeBr(event.createdAt)}
              </span>
              {event.note ? (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {event.note}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
