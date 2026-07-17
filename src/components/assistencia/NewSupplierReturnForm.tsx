"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createSupplierReturn, type SupplierReturnFormState } from "@/app/assistencia/fornecedores-actions";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function NewSupplierReturnForm({ suppliers }: { suppliers: string[] }) {
  const [state, formAction, pending] = useActionState<SupplierReturnFormState, FormData>(createSupplierReturn, undefined);
  const [supplier, setSupplier] = useState("");

  if (state?.success) {
    return (
      <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Remessa registrada!
        </p>
        <Link href="/assistencia/fornecedores" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Peça *">
        <input name="part_name" required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Produto do cliente">
        <input name="product" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Fornecedor">
        <select
          name="supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          <option value="">Selecione…</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="__outro__">Outro…</option>
        </select>
      </Field>
      {supplier === "__outro__" ? (
        <Field label="Nome do fornecedor">
          <input name="supplier_other" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nº da nota fiscal">
          <input name="invoice_number" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Valor faturado (R$)">
          <input name="invoice_value" type="number" min={0} step="0.01" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Data de envio">
          <input name="sent_at" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Retorno esperado">
          <input name="expected_return_at" type="date" className="rounded border px-3 py-2" style={inputStyle} />
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
        {pending ? "Criando…" : "Registrar remessa"}
      </button>
    </form>
  );
}
