"use client";

import { useActionState } from "react";
import { addAssembler, addSupplier, addDriver, type FormState } from "@/app/assistencia/admin-actions";

export function AddSimpleEntryForm({ kind }: { kind: "assembler" | "supplier" | "driver" }) {
  const action = kind === "assembler" ? addAssembler : kind === "driver" ? addDriver : addSupplier;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2 mt-2 flex-wrap">
      <input
        name="name"
        placeholder={kind === "assembler" ? "Novo montador" : kind === "driver" ? "Novo motorista" : "Novo fornecedor"}
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
    </form>
  );
}
