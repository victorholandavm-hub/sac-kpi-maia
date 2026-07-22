"use client";

import { useState } from "react";
import { proposeNewDeadline } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import type { DeadlineStatus } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_COLOR: Record<DeadlineStatus, string> = {
  aprovado: "var(--brand-green)",
  recusado: "var(--status-critical)",
  pendente: "var(--status-warning)",
};

export function LojaDeadlineControl({
  requestId,
  requestedDeadline,
  deadlineStatus,
  approvedDeadline,
  highlight,
}: {
  requestId: string;
  requestedDeadline: string | null;
  deadlineStatus: DeadlineStatus;
  approvedDeadline: string | null;
  highlight?: boolean;
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");

  const shownDate = deadlineStatus === "aprovado" ? approvedDeadline : deadlineStatus === "recusado" ? approvedDeadline : requestedDeadline;
  const statusLabel =
    deadlineStatus === "aprovado"
      ? "aprovado"
      : deadlineStatus === "recusado"
        ? "nova data proposta pela assistência"
        : "aguardando aprovação";
  const color = STATUS_COLOR[deadlineStatus] ?? "var(--text-muted)";

  return (
    <div className="flex flex-col gap-1.5 items-start sm:items-end">
      {!editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          {shownDate ? (
            <span
              className={highlight ? "text-xs font-bold px-2.5 py-1 rounded-lg" : "text-xs font-semibold px-2 py-0.5 rounded-lg"}
              style={{ color, background: "var(--surface-1)", border: `1.5px solid ${color}` }}
            >
              Prazo: {formatDateOnly(shownDate)} ({statusLabel})
            </span>
          ) : (
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Sem prazo definido
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium rounded-lg border px-2 py-1 whitespace-nowrap"
            style={{ borderColor: "var(--brand-orange)", color: "var(--brand-orange)" }}
          >
            Propor data
          </button>
        </div>
      ) : (
        <>
          {shownDate ? (
            <span
              className={highlight ? "text-xs font-bold px-2.5 py-1 rounded-lg" : "text-xs font-semibold px-2 py-0.5 rounded-lg"}
              style={{ color, background: "var(--surface-1)", border: `1.5px solid ${color}` }}
            >
              Prazo: {formatDateOnly(shownDate)} ({statusLabel})
            </span>
          ) : (
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Sem prazo definido
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
              autoFocus
            />
            <button
              disabled={pending || !date}
              onClick={() =>
                run(async () => {
                  await proposeNewDeadline(requestId, date);
                  setEditing(false);
                  setDate("");
                }, "Nova data proposta.")
              }
              className="text-xs rounded px-2 py-1 disabled:opacity-60"
              style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
            >
              Enviar
            </button>
            <button onClick={() => setEditing(false)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
              cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
