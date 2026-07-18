"use client";

import { useActionState } from "react";
import { addGerente, type FormState } from "@/app/assistencia/admin-actions";
import type { Store } from "@/lib/serviceRequests";

export function AddGerenteForm({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addGerente, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          name="name"
          placeholder="Nome do gerente"
          required
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
        {state?.error ? (
          <span className="text-xs" style={{ color: "var(--status-critical)" }}>
            {state.error}
          </span>
        ) : null}
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Marque todas as lojas que esse gerente cuida (dá pra marcar mais de uma):
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 max-h-32 overflow-y-auto">
        {stores.map((s) => (
          <label key={s.id} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" name="store_ids" value={s.id} />
            {s.name}
          </label>
        ))}
      </div>
    </form>
  );
}
