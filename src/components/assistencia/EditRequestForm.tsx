"use client";

import { useActionState, useState } from "react";
import { updateRequestDetails, type FormState } from "@/app/assistencia/actions";
import { ADDRESS_NUMBER_REQUIRED_TYPES, type ServiceRequestDetail, type Store } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, DELIVERY_REQUEST_TYPES, CAUSA_RAIZ_OPTIONS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";

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
  drivers,
  cargas,
}: {
  request: ServiceRequestDetail;
  stores: Store[];
  editableTypes: readonly string[];
  drivers: string[];
  cargas: { carga: string; label: string }[];
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
  // Só tipos que passam por montador/técnico -- os 4 tipos de entrega
  // (troca/entrega de produto, envio/recolhimento de peça) são sempre
  // motorista, sem montador pra instruir, e notificação externa não tem
  // visita nenhuma.
  const showMontadorInstruction = ["montagem", "desmontagem", "troca_peca", "vistoria"].includes(type);
  const showAuthorizedBy = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(type);
  // "Quem errou" (causa_raiz/causa_carga/causa_conferente/driver_name) só
  // era preenchível na criação (SacCreateRequestForm.tsx) -- pedido do
  // Victor 29/08/2026: "hoje nao consigo alterar a carga e o motorista que
  // errou". Mesmo padrão visual/condicional de lá: erro_conferencia pede
  // carga+conferente, erro_motorista pede carga+motorista, "outro" pede o
  // detalhe -- só que aqui já parte do valor atual do chamado, não vazio.
  const [causaRaiz, setCausaRaiz] = useState(request.causaRaiz ?? "");

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

      <Field label={causaRaiz === "erro_vendedor" ? "Vendedor(a) *" : "Vendedor(a)"}>
        <input
          name="seller_name"
          defaultValue={request.sellerName ?? ""}
          required={causaRaiz === "erro_vendedor"}
          className="rounded border px-3 py-2"
          style={causaRaiz === "erro_vendedor" ? { borderColor: "var(--status-critical)" } : inputStyle}
        />
      </Field>
      {/* Pedido do Victor 04/09/2026: "quando for erro do vendedor,
          obrigatorio colocar o nome do vendedor" -- aqui reaproveita o
          campo Vendedor(a) já existente lá em cima (geral, sempre visível)
          em vez de duplicar um segundo campo, só destaca que ficou
          obrigatório nesse caso. */}
      {causaRaiz === "erro_vendedor" ? (
        <p className="text-xs font-medium -mt-2" style={{ color: "var(--status-critical)" }}>
          Erro do vendedor -- preencha o campo Vendedor(a) acima.
        </p>
      ) : null}

      <Field label="Nome do cliente *">
        <input name="client_name" defaultValue={request.clientName ?? ""} required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CPF *">
          <input name="client_cpf" defaultValue={request.clientCpf ?? ""} required className="rounded border px-3 py-2" style={inputStyle} />
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

      {showAuthorizedBy ? (
        <Field label="Quem errou (controle interno)">
          <select
            name="causa_raiz"
            value={causaRaiz}
            onChange={(e) => setCausaRaiz(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="">Não informado</option>
            {CAUSA_RAIZ_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CAUSA_RAIZ_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {showAuthorizedBy && (causaRaiz === "erro_conferencia" || causaRaiz === "sujeira_conferencia") ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
            {causaRaiz === "sujeira_conferencia"
              ? "Sujeira não barrada na conferência -- precisa registrar qual carga e quem conferiu."
              : "Erro de conferência -- precisa registrar qual carga e quem conferiu."}
          </p>
          <Field label="Carga *">
            <input
              name="causa_carga"
              list="edit-cargas"
              required
              defaultValue={request.causaCarga ?? ""}
              placeholder="Ex: 000123"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
            <datalist id="edit-cargas">
              {cargas.map((c) => (
                <option key={c.carga} value={c.carga}>
                  {c.label}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Conferente *">
            <input
              name="causa_conferente"
              required
              defaultValue={request.causaConferente ?? ""}
              placeholder="Nome de quem conferiu a carga"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        </div>
      ) : null}

      {showAuthorizedBy && causaRaiz === "erro_motorista" ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
            Erro do motorista -- precisa registrar qual carga e quem entregou.
          </p>
          <Field label="Carga *">
            <input
              name="causa_carga"
              list="edit-cargas"
              required
              defaultValue={request.causaCarga ?? ""}
              placeholder="Ex: 000123"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
            <datalist id="edit-cargas">
              {cargas.map((c) => (
                <option key={c.carga} value={c.carga}>
                  {c.label}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label="Motorista que entregou (erro) *">
            <input
              name="driver_name"
              list="edit-drivers"
              required
              defaultValue={request.driverName ?? ""}
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
            <datalist id="edit-drivers">
              {drivers.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>
        </div>
      ) : null}

      {showAuthorizedBy && causaRaiz === "outro" ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
            Causa raiz &quot;Outro&quot; -- descreva exatamente o que houve.
          </p>
          <Field label="O que houve, exatamente *">
            <textarea
              name="causa_raiz_detalhe"
              rows={2}
              required
              defaultValue={request.causaRaizDetalhe ?? ""}
              placeholder="Descreva a causa raiz com o máximo de detalhe"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        </div>
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

      {showAuthorizedBy ? (
        <Field label="Restrição de horário do cliente">
          <input
            name="client_time_restriction"
            defaultValue={request.clientTimeRestriction ?? ""}
            placeholder="Ex: só de manhã, ou das 14h às 17h"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      ) : null}

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
