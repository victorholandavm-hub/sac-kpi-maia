"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSupplierReturnStatus, addSupplierReturnNote } from "@/app/assistencia/fornecedores-actions";
import { SUPPLIER_RETURN_STATUS_LABELS } from "@/lib/assistenciaLabels";

const NEXT_STATUSES: Record<string, string[]> = {
  aguardando_envio: ["enviado"],
  enviado: ["recebido"],
  recebido: ["reembolsado"],
  reembolsado: ["finalizado"],
  finalizado: [],
};

export function SupplierReturnActions({ returnId, status }: { returnId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [reimbursedValue, setReimbursedValue] = useState("");
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
    <div className="flex flex-col gap-3 rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {status === "recebido" ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={reimbursedValue}
            onChange={(e) => setReimbursedValue(e.target.value)}
            placeholder="Valor reembolsado (R$)"
            className="w-40 rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            disabled={pending || !reimbursedValue}
            onClick={() => {
              const parsed = parseFloat(reimbursedValue.replace(",", "."));
              if (!Number.isFinite(parsed) || parsed < 0) {
                setError("Valor inválido.");
                return;
              }
              run(() => updateSupplierReturnStatus(returnId, "reembolsado", parsed));
            }}
            className="text-sm rounded px-3 py-2 border disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            Marcar como reembolsado
          </button>
        </div>
      ) : nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => run(() => updateSupplierReturnStatus(returnId, s))}
              className="text-sm rounded px-3 py-2 border disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              Marcar como {SUPPLIER_RETURN_STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Remessa finalizada.
        </p>
      )}

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
              await addSupplierReturnNote(returnId, note);
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
