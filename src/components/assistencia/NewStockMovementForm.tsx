"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createStockMovement, type StockMovementFormState } from "@/app/assistencia/estoque-actions";
import { MOVEMENT_TYPE_LABELS } from "@/lib/assistenciaLabels";

const TYPES = ["retirado", "devolvido", "reparado"] as const;

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function NewStockMovementForm({ factories }: { factories: string[] }) {
  const [state, formAction, pending] = useActionState<StockMovementFormState, FormData>(createStockMovement, undefined);
  const [factory, setFactory] = useState("");

  if (state?.success) {
    return (
      <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Movimentação registrada!
        </p>
        <Link href="/assistencia/estoque" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Tipo de movimentação">
        <select name="movement_type" defaultValue="retirado" className="rounded border px-3 py-2" style={inputStyle}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Código">
          <input name="code" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Produto *">
          <input name="product" required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Fábrica/Fornecedor">
        <select
          name="factory"
          value={factory}
          onChange={(e) => setFactory(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          <option value="">Selecione…</option>
          {factories.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value="__outro__">Outro…</option>
        </select>
      </Field>
      {factory === "__outro__" ? (
        <Field label="Nome da fábrica/fornecedor">
          <input name="factory_other" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Cliente atendido">
          <input name="client_name" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Volume">
          <input name="volume" placeholder="Ex: 1/2" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Data da movimentação">
          <input name="movement_date" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Data de lançamento">
          <input name="logged_date" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Observações">
        <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded px-4 py-2 font-medium self-start disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Registrando…" : "Registrar movimentação"}
      </button>
    </form>
  );
}
