"use client";

import { useActionState } from "react";
import { addGerente, type FormState } from "@/app/assistencia/admin-actions";
import type { Store } from "@/lib/serviceRequests";

export function AddGerenteForm({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addGerente, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2 mt-2 flex-wrap">
      <input
        name="name"
        placeholder="Nome do gerente"
        required
        className="rounded border px-2 py-1 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <select name="store_id" required defaultValue="" className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--border)" }}>
        <option value="" disabled>
          Loja…
        </option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
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
    </form>
  );
}
