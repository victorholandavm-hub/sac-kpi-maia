"use client";

import { useActionState } from "react";
import { createEstornoRequestAction, type EstornoFormState } from "@/app/assistencia/estornos-actions";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {required ? <span style={{ color: "var(--status-critical)" }}> *</span> : null}
      {children}
    </label>
  );
}

// Campos do print de referência do Victor (WhatsApp de estorno, 23/09/2026)
// -- mesmo padrão de formulário de NewPartOrderForm.tsx (FormData + Server
// Action, anexo obrigatório).
export function NovoEstornoRequestForm({ storeOptions }: { storeOptions?: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<EstornoFormState, FormData>(createEstornoRequestAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {storeOptions && storeOptions.length > 1 ? (
        <Field label="Loja" required>
          <select name="store_id" required className="rounded border px-3 py-2" style={inputStyle} defaultValue="">
            <option value="" disabled>
              Selecione a loja
            </option>
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Cliente" required>
        <input name="cliente_nome" type="text" required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CPF">
          <input name="cpf" type="text" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Código do cliente">
          <input name="codigo_cliente" type="text" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="NF de entrada">
          <input name="nf_entrada" type="text" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="NF de devolução">
          <input name="nf_devolucao" type="text" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor do reembolso (R$)" required>
          <input name="valor_reembolso" type="text" inputMode="decimal" required placeholder="0,00" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Data da venda">
          <input name="data_venda" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      <Field label="Forma de pagamento">
        <input name="forma_pagamento" type="text" placeholder="Ex.: 6x Master" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <Field label="Produto">
        <input name="produto" type="text" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <Field label="Motivo">
        <textarea name="motivo" rows={2} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <Field label="Autorizado por">
        <input name="autorizado_por" type="text" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Comprovante da venda (foto ou PDF)" required>
        <input name="anexo" type="file" accept="image/*,application/pdf" required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start text-sm px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-60"
        style={{ background: "#1B5E3C" }}
      >
        {pending ? "Enviando…" : "Enviar solicitação"}
      </button>
    </form>
  );
}
