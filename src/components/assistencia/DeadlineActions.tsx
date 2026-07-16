"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDeadline, rejectDeadline } from "@/app/assistencia/actions";

export function DeadlineActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [proposedDate, setProposedDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    });
  }

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
        onClick={() => run(() => approveDeadline(requestId))}
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
          onClick={() => run(() => rejectDeadline(requestId, proposedDate))}
          className="text-sm rounded px-3 py-2 border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Recusar e propor
        </button>
      </div>

      {error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
