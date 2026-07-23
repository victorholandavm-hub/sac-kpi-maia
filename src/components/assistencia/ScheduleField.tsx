"use client";

import { useState } from "react";
import { setSchedule } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { SHIFTS, type Shift } from "@/lib/serviceRequests";
import { ROTA_LABELS, type Rota } from "@/lib/rotas";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatTimeOnly(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

export function ScheduleField({
  requestId,
  scheduledDate,
  scheduledTime,
  shift,
  rota,
  rotaExceptionNote,
  nextDatesByRota,
}: {
  requestId: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  shift: Shift | null;
  rota: Rota | null;
  rotaExceptionNote: string | null;
  nextDatesByRota: Record<Rota, string[]>;
}) {
  const { pending, run, showToast } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [time, setTime] = useState(formatTimeOnly(scheduledTime) ?? "");
  const [selectedShift, setSelectedShift] = useState<string>(shift ?? "");
  const [selectedRota, setSelectedRota] = useState<string>(rota ?? "");
  const [exception, setException] = useState(false);
  const [exceptionNote, setExceptionNote] = useState(rotaExceptionNote ?? "");

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Visita agendada
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {scheduledDate
              ? `${formatDateOnly(scheduledDate)}${formatTimeOnly(scheduledTime) ? ` às ${formatTimeOnly(scheduledTime)}` : ""}${shift ? ` · ${SHIFT_LABELS[shift]}` : ""}${rota ? ` · rota ${ROTA_LABELS[rota]}` : ""}`
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
        {rotaExceptionNote ? (
          <span className="text-xs" style={{ color: "var(--status-warning)" }}>
            Fora da rota do dia: {rotaExceptionNote}
          </span>
        ) : null}
      </div>
    );
  }

  const validDatesForRota = selectedRota ? nextDatesByRota[selectedRota as Rota] ?? [] : [];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Visita agendada
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedRota}
          onChange={(e) => setSelectedRota(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">Sem rota</option>
          {(Object.keys(ROTA_LABELS) as Rota[]).map((r) => (
            <option key={r} value={r}>
              {ROTA_LABELS[r]}
            </option>
          ))}
        </select>
        {selectedRota && validDatesForRota.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {validDatesForRota.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                className="text-xs rounded-full px-2 py-1 border whitespace-nowrap"
                style={
                  date === d
                    ? { background: "var(--brand-green)", color: "var(--brand-green-ink)", borderColor: "var(--brand-green)" }
                    : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                }
              >
                {formatDateOnly(d)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={!exception && !!selectedRota}
          className="rounded border px-2 py-1 text-sm disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
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
      </div>

      {selectedRota ? (
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={exception} onChange={(e) => setException(e.target.checked)} className="rounded" />
          Encaixar fora da rota do dia (data que não é de {ROTA_LABELS[selectedRota as Rota]})
        </label>
      ) : null}

      {selectedRota && exception ? (
        <textarea
          value={exceptionNote}
          onChange={(e) => setExceptionNote(e.target.value)}
          rows={2}
          placeholder="Motivo do encaixe — ex: único dia que o cliente recebe, cliente Procon urgente…"
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--status-warning)" }}
        />
      ) : null}

      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() => {
            if (selectedRota && exception && !exceptionNote.trim()) {
              showToast("Informe o motivo do encaixe fora da rota.", "error");
              return;
            }
            run(async () => {
              await setSchedule(requestId, date, selectedShift, time, selectedRota || undefined, exceptionNote || undefined);
              setEditing(false);
            }, "Agenda atualizada.");
          }}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setDate(scheduledDate ?? "");
            setTime(formatTimeOnly(scheduledTime) ?? "");
            setSelectedShift(shift ?? "");
            setSelectedRota(rota ?? "");
            setException(false);
            setExceptionNote(rotaExceptionNote ?? "");
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
