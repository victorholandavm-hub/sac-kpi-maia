"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLegalDeadline } from "@/app/assistencia/actions";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function LegalDeadlineField({ requestId, legalDeadline }: { requestId: string; legalDeadline: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(legalDeadline ?? "");
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = !!legalDeadline && today > legalDeadline;

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Prazo legal
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: overdue ? "var(--status-critical)" : "var(--text-primary)" }}>
            {legalDeadline ? `${formatDateOnly(legalDeadline)}${overdue ? " · vencido" : ""}` : "Não definido"}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Prazo legal
      </span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <button
          disabled={pending || !date}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await setLegalDeadline(requestId, date);
                setEditing(false);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro inesperado.");
              }
            });
          }}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setDate(legalDeadline ?? "");
            setEditing(false);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
      {error ? (
        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
