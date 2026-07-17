"use client";

import { useState } from "react";
import { approveDeadline, rejectDeadline } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

export function DeadlineActions({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [proposedDate, setProposedDate] = useState("");

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--status-warning)" }}
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Prazo pendente de aprovação
      </h3>

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
          Ou propor outra data:
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
          Recusar e propor
        </button>
      </div>
    </div>
  );
}
