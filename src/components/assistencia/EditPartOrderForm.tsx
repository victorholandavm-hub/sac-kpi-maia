"use client";

import { useActionState, useState } from "react";
import { updatePartOrder, type PartOrderFormState } from "@/app/assistencia/pecas-actions";
import type { PartOrder, SupplierContact } from "@/lib/partOrders";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

// Corrigir um pedido de peça já criado -- pedido do Victor 10/09/2026:
// "preciso que tenha a opção de editar cada demanda, para isso eu preciso
// entrar na solicitação de peça". Mesmo formulário de NewPartOrderForm.tsx
// (inclusive o autopreenchimento de contato ao trocar fornecedor), só que
// partindo dos valores já salvos em vez de em branco, e chamando
// updatePartOrder (que redireciona de volta pro detalhe) em vez de
// createPartOrder. `notes` fica de fora -- é log (ver comentário em
// pecas-actions.ts), continua só editável via "Adicionar nota" na tela de
// detalhe.
export function EditPartOrderForm({
  order,
  suppliers,
  supplierContacts,
}: {
  order: PartOrder;
  suppliers: string[];
  supplierContacts: Record<string, SupplierContact>;
}) {
  const boundAction = updatePartOrder.bind(null, order.id);
  const [state, formAction, pending] = useActionState<PartOrderFormState, FormData>(boundAction, undefined);

  // Fornecedor atual pode não estar na lista de sugestões (digitado como
  // "Outro…" na criação) -- mesmo raciocínio de EditRequestForm.tsx (tipo
  // atual sempre aparece como opção): garante que o select nunca fica
  // "sem opção selecionada" nem sujeita o valor original.
  const supplierIsKnown = !order.supplier || suppliers.includes(order.supplier);
  const [supplier, setSupplier] = useState(supplierIsKnown ? (order.supplier ?? "") : "__outro__");
  const [representative, setRepresentative] = useState(order.representative ?? "");
  const [representativeEmail, setRepresentativeEmail] = useState(order.representativeEmail ?? "");
  const [representativePhone, setRepresentativePhone] = useState(order.representativePhone ?? "");

  function handleSupplierChange(value: string) {
    setSupplier(value);
    const contact = supplierContacts[value];
    setRepresentative(contact?.representative ?? "");
    setRepresentativeEmail(contact?.representativeEmail ?? "");
    setRepresentativePhone(contact?.representativePhone ?? "");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Peça *">
        <input name="part_name" required defaultValue={order.partName} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Código da peça">
          <input name="part_code" defaultValue={order.partCode ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Cor">
          <input name="color" defaultValue={order.color ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
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
          <input name="supplier_other" defaultValue={supplierIsKnown ? "" : (order.supplier ?? "")} className="rounded border px-3 py-2" style={inputStyle} />
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
          <input name="product" defaultValue={order.product ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Nome do cliente">
          <input name="client_name" defaultValue={order.clientName ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CPF do cliente">
          <input name="client_cpf" defaultValue={order.clientCpf ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Telefone">
          <input name="client_phone" defaultValue={order.clientPhone ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="E-mail de contato">
        <input name="client_email" type="email" defaultValue={order.clientEmail ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
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
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
