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

export function LojaDeadlineControl({
  requestId,
  requestedDeadline,
  deadlineStatus,
  approvedDeadline,
}: {
  requestId: string;
  requestedDeadline: string | null;
  deadlineStatus: DeadlineStatus;
  approvedDeadline: string | null;
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

  return (
    <div className="flex flex-col gap-1">
      {shownDate ? (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Prazo: {formatDateOnly(shownDate)} ({statusLabel})
        </span>
      ) : (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Sem prazo definido
        </span>
      )}

      {!editing ? (
        <button onClick={() => setEditing(true)} className="text-xs underline self-start" style={{ color: "var(--text-secondary)" }}>
          propor outra data
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
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
      )}
    </div>
  );
}
