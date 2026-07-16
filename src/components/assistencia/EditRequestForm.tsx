"use client";

import { useActionState } from "react";
import { updateRequestDetails, type FormState } from "@/app/assistencia/actions";
import type { ServiceRequestDetail, Store } from "@/lib/serviceRequests";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function EditRequestForm({ request, stores }: { request: ServiceRequestDetail; stores: Store[] }) {
  const boundAction = updateRequestDetails.bind(null, request.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Loja *">
        <select name="store_id" defaultValue={request.storeId} required className="rounded border px-3 py-2" style={inputStyle}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Código do pedido/venda">
        <input name="order_code" defaultValue={request.orderCode ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Nome do cliente *">
        <input name="client_name" defaultValue={request.clientName ?? ""} required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CPF">
          <input name="client_cpf" defaultValue={request.clientCpf ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Telefone">
          <input name="client_phone" defaultValue={request.clientPhone ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Endereço">
          <input name="client_address" defaultValue={request.clientAddress ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Bairro">
          <input name="client_neighborhood" defaultValue={request.clientNeighborhood ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Motivo">
        <textarea name="reason" defaultValue={request.reason ?? ""} rows={2} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Restrição / observação">
        <input name="restriction_note" defaultValue={request.restrictionNote ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Observações">
        <textarea name="notes" defaultValue={request.notes ?? ""} rows={3} className="rounded border px-3 py-2" style={inputStyle} />
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
        {pending ? "Salvando…" : "Salvar correções"}
      </button>
    </form>
  );
}
