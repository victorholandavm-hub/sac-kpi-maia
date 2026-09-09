"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createPartOrder, type PartOrderFormState } from "@/app/assistencia/pecas-actions";
import type { SupplierContact } from "@/lib/partOrders";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function NewPartOrderForm({
  suppliers,
  supplierContacts,
  defaultValues,
}: {
  suppliers: string[];
  // Contato do representante por fornecedor -- pedido do Victor 09/09/2026:
  // "quando... selecionar o fornecedor, já deve puxar automaticamente o
  // nome, contato e e-mail do representante". Preenche os 3 campos abaixo
  // sozinho ao trocar o select; quem digitar por cima continua podendo
  // (campos ficam controlados, não travados).
  supplierContacts: Record<string, SupplierContact>;
  defaultValues?: {
    serviceRequestId?: string;
    clientName?: string;
    clientCpf?: string;
    clientPhone?: string;
    product?: string;
  };
}) {
  const [state, formAction, pending] = useActionState<PartOrderFormState, FormData>(createPartOrder, undefined);
  const [supplier, setSupplier] = useState("");
  const [representative, setRepresentative] = useState("");
  const [representativeEmail, setRepresentativeEmail] = useState("");
  const [representativePhone, setRepresentativePhone] = useState("");

  function handleSupplierChange(value: string) {
    setSupplier(value);
    const contact = supplierContacts[value];
    setRepresentative(contact?.representative ?? "");
    setRepresentativeEmail(contact?.representativeEmail ?? "");
    setRepresentativePhone(contact?.representativePhone ?? "");
  }

  if (state?.success) {
    return (
      <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Pedido de peça criado!
        </p>
        <Link href="/assistencia/pecas" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {defaultValues?.serviceRequestId ? (
        <input type="hidden" name="service_request_id" value={defaultValues.serviceRequestId} />
      ) : null}

      <Field label="Peça *">
        <input name="part_name" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Código da peça">
          <input name="part_code" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Cor">
          <input name="color" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Fornecedor">
        <select
          name="supplier"
          value={supplier}
          onChange={(e) => handleSupplierChange(e.target.value)}
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

      <Field label="Representante do fornecedor">
        <input
          name="representative"
          value={representative}
          onChange={(e) => setRepresentative(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
      </Field>

      {/* Contato do REPRESENTANTE (fornecedor) -- distinto do e-mail/telefone
          do cliente lá embaixo (pedido do Victor 09/09/2026, planilha
          "Solicitação de peças"). Preenchidos sozinhos ao escolher o
          fornecedor (ver handleSupplierChange acima) -- continua editável
          por cima, pra representante novo/trocado. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="E-mail do representante">
          <input
            name="representative_email"
            type="email"
            value={representativeEmail}
            onChange={(e) => setRepresentativeEmail(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Telefone do representante">
          <input
            name="representative_phone"
            value={representativePhone}
            onChange={(e) => setRepresentativePhone(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Produto do cliente">
          <input
            name="product"
            defaultValue={defaultValues?.product}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Nome do cliente">
          <input
            name="client_name"
            defaultValue={defaultValues?.clientName}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CPF do cliente">
          <input
            name="client_cpf"
            defaultValue={defaultValues?.clientCpf}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Telefone">
          <input
            name="client_phone"
            defaultValue={defaultValues?.clientPhone}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="E-mail de contato">
        <input name="client_email" type="email" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

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
        {pending ? "Criando…" : "Criar pedido de peça"}
      </button>
    </form>
  );
}
