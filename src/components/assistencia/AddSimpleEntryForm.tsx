"use client";

import { useActionState } from "react";
import { addAssembler, addSupplier, addDriver, addCdOperador, addFabricaOperador, type FormState } from "@/app/assistencia/admin-actions";

const ACTIONS = {
  assembler: addAssembler,
  driver: addDriver,
  supplier: addSupplier,
  cd: addCdOperador,
  fabrica: addFabricaOperador,
};

const PLACEHOLDERS = {
  assembler: "Novo montador",
  driver: "Novo motorista",
  supplier: "Novo fornecedor",
  cd: "Novo operador do CD",
  fabrica: "Novo operador da fábrica",
};

export function AddSimpleEntryForm({ kind }: { kind: keyof typeof ACTIONS }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(ACTIONS[kind], undefined);

  return (
    <form action={formAction} className="flex items-center gap-2 mt-2 flex-wrap">
      <input
        name="name"
        placeholder={PLACEHOLDERS[kind]}
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
