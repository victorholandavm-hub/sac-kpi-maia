"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimRequest, updateStatus, addNote } from "@/app/assistencia/actions";
import { STATUS_LABELS } from "@/lib/assistenciaLabels";

const NEXT_STATUSES: Record<string, string[]> = {
  aberta: ["em_contato", "cancelada"],
  em_contato: ["em_andamento", "cancelada"],
  em_andamento: ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

export function RequestActions({
  requestId,
  status,
  isAssignedToMe,
}: {
  requestId: string;
  status: string;
  isAssignedToMe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
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

  const nextStatuses = NEXT_STATUSES[status] ?? [];

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {!isAssignedToMe ? (
        <button
          disabled={pending}
          onClick={() => run(() => claimRequest(requestId))}
          className="text-sm rounded px-3 py-2 self-start disabled:opacity-60"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Assumir para mim
        </button>
      ) : null}

      {nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => run(() => updateStatus(requestId, s))}
              className="text-sm rounded px-3 py-2 border disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              Marcar como {STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Adicionar observação…"
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await addNote(requestId, note);
              setNote("");
            })
          }
          className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Adicionar nota
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
