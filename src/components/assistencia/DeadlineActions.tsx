"use client";

import { useState } from "react";
import { approveDeadline, rejectDeadline } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function DeadlineActions({
  requestId,
  requestedDeadline,
  deadlineStatus,
  approvedDeadline,
}: {
  requestId: string;
  requestedDeadline: string | null;
  deadlineStatus: "pendente" | "recusado";
  approvedDeadline: string | null;
}) {
  const { pending, run } = useQuickAction();
  const [proposedDate, setProposedDate] = useState("");
  const isRecusado = deadlineStatus === "recusado";

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        {isRecusado ? "Nova data proposta pela assistência" : "Prazo pendente de aprovação"}
      </h3>

      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Prazo pedido pelo gerente: <strong>{formatDateOnly(requestedDeadline) ?? "—"}</strong>
      </p>
      {isRecusado ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Data proposta atualmente: <strong>{formatDateOnly(approvedDeadline) ?? "—"}</strong>
        </p>
      ) : null}

      <button
        disabled={pending}
        onClick={() => run(() => approveDeadline(requestId), "Prazo aprovado.")}
        className="text-sm rounded px-3 py-2 self-start disabled:opacity-60"
        style={{ background: "var(--status-good)", color: "#fff" }}
      >
        Aprovar prazo pedido
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {isRecusado ? "Alterar a data proposta:" : "Ou propor outra data:"}
        </span>
        <input
          type="date"
          value={proposedDate}
          onChange={(e) => setProposedDate(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          disabled={pending || !proposedDate}
          onClick={() => run(() => rejectDeadline(requestId, proposedDate), "Nova data proposta.")}
          className="text-sm rounded px-3 py-2 border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          {isRecusado ? "Atualizar data proposta" : "Recusar e propor"}
        </button>
      </div>
    </div>
  );
}
