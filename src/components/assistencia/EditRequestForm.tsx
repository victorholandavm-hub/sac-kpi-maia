"use client";

import { useActionState, useState } from "react";
import { updateRequestDetails, type FormState } from "@/app/assistencia/actions";
import { ADDRESS_NUMBER_REQUIRED_TYPES, type ServiceRequestDetail, type Store } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, DELIVERY_REQUEST_TYPES } from "@/lib/assistenciaLabels";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function EditRequestForm({
  request,
  stores,
  editableTypes,
}: {
  request: ServiceRequestDetail;
  stores: Store[];
  editableTypes: readonly string[];
}) {
  const boundAction = updateRequestDetails.bind(null, request.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, undefined);
  // O tipo atual sempre aparece como opção, mesmo que por algum motivo não
  // esteja na lista do papel (não deveria acontecer -- quem chega até aqui
  // já passou pelo canEdit em page.tsx -- mas evita sumir com o valor atual
  // do <select> se acontecer).
  const typeOptions = editableTypes.includes(request.type) ? editableTypes : [request.type, ...editableTypes];
  const [type, setType] = useState<string>(request.type);
  const showAddressNumber = (ADDRESS_NUMBER_REQUIRED_TYPES as readonly string[]).includes(type);
  const [isApartment, setIsApartment] = useState(request.clientIsApartment);
  // Só tipos que passam por montador/técnico -- entrega é sempre motorista
  // (sem montador pra instruir) e notificação externa não tem visita
  // nenhuma.
  const showMontadorInstruction = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria"].includes(type);
  const showAuthorizedBy = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(type);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {typeOptions.length > 1 ? (
        <Field label="Tipo *">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="type" value={type} />
      )}

      <Field label="Loja *">
        <select name="store_id" defaultValue={request.storeId} required className="rounded border px-3 py-2" style={inputStyle}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Código do pedido/venda">
          <input name="order_code" defaultValue={request.orderCode ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Nº da nota fiscal">
          <input name="invoice_number" defaultValue={request.invoiceNumber ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Vendedor(a)">
        <input name="seller_name" defaultValue={request.sellerName ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
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

      {showAddressNumber ? (
        <div className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Número *">
              <input
                name="client_address_number"
                required
                defaultValue={request.clientAddressNumber ?? ""}
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm self-end pb-2" style={{ color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                name="client_is_apartment"
                checked={isApartment}
                onChange={(e) => setIsApartment(e.target.checked)}
                className="rounded"
              />
              É apartamento/prédio?
            </label>
          </div>
          {isApartment ? (
            <Field label="Apto/Bloco *">
              <input
                name="client_address_complement"
                required
                defaultValue={request.clientAddressComplement ?? ""}
                placeholder="Ex: Apto 302, Bloco B"
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <Field label="Motivo">
        <textarea name="reason" defaultValue={request.reason ?? ""} rows={2} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {showAuthorizedBy ? (
        <Field label="Autorizado por">
          <input
            name="authorized_by"
            defaultValue={request.authorizedBy ?? ""}
            placeholder="Nome de quem autorizou (gerente, supervisor…)"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      ) : null}

      {showMontadorInstruction ? (
        <Field label="Instrução pro montador (visível pra ele, separado do Motivo acima)">
          <textarea
            name="montador_instruction"
            defaultValue={request.montadorInstruction ?? ""}
            rows={2}
            placeholder="Ex: cliente prefere que chegue depois das 14h, subir móvel pelo elevador de serviço…"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      ) : null}

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
