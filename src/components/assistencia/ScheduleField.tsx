"use client";

import { useState } from "react";
import { setSchedule } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { SHIFTS, type Shift } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function ScheduleField({
  requestId,
  scheduledDate,
  shift,
}: {
  requestId: string;
  scheduledDate: string | null;
  shift: Shift | null;
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [selectedShift, setSelectedShift] = useState<string>(shift ?? "");

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Visita agendada
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {scheduledDate
              ? `${formatDateOnly(scheduledDate)}${shift ? ` · ${SHIFT_LABELS[shift]}` : ""}`
              : "Não agendada"}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            {scheduledDate ? "editar" : "agendar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Visita agendada
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <select
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">Sem turno</option>
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              {SHIFT_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() =>
            run(async () => {
              await setSchedule(requestId, date, selectedShift);
              setEditing(false);
            }, "Agenda atualizada.")
          }
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setDate(scheduledDate ?? "");
            setSelectedShift(shift ?? "");
            setEditing(false);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
