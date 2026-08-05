"use client";

import { useActionState, useState } from "react";
import { editServiceRequestByGerente, lookupTotvsProduct, type FormState } from "@/app/assistencia/actions";
import type { ServiceRequestDetail } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

type Item = { product: string; quantity: number; code: string };
type ProductLookupStatus = "idle" | "loading" | "found" | "not_found";

function ProductItemsFields({
  items,
  lookupStatus,
  onUpdate,
  onAdd,
  onRemove,
  onLookup,
  namePrefix,
}: {
  items: Item[];
  lookupStatus: Record<number, ProductLookupStatus>;
  onUpdate: (index: number, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onLookup: (index: number, code: string) => void;
  namePrefix: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              name={`${namePrefix}_code`}
              value={item.code}
              onChange={(e) => onUpdate(i, { code: e.target.value })}
              onBlur={(e) => onLookup(i, e.target.value)}
              placeholder="Código"
              className="w-28 rounded border px-3 py-2"
              style={inputStyle}
            />
            <input
              name={`${namePrefix}_product`}
              value={item.product}
              onChange={(e) => onUpdate(i, { product: e.target.value })}
              required
              placeholder="Ex: Roupeiro Giardino"
              className="flex-1 rounded border px-3 py-2"
              style={inputStyle}
            />
            <input
              name={`${namePrefix}_quantity`}
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => onUpdate(i, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-20 rounded border px-3 py-2"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              disabled={items.length === 1}
              className="text-sm px-2 py-2 disabled:opacity-40"
              style={{ color: "var(--status-critical)" }}
              aria-label="Remover item"
            >
              remover
            </button>
          </div>
          {lookupStatus[i] === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </span>
          ) : lookupStatus[i] === "not_found" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Código não encontrado.
            </span>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="text-sm self-start underline" style={{ color: "var(--text-secondary)" }}>
        + adicionar produto
      </button>
    </div>
  );
}

// Edição do que o próprio gerente abriu (ver editServiceRequestByGerente em
// src/app/assistencia/actions.ts) -- ao contrário do PublicRequestForm.tsx
// (criação), aqui tipo e "pra quem é" (cliente x mostruário) já vêm fixos
// do chamado existente, não dá pra trocar.
export function EditServiceRequestForm({ request }: { request: ServiceRequestDetail }) {
  const boundAction = editServiceRequestByGerente.bind(null, request.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, undefined);

  const type = request.type;
  const isStoreTarget = !request.orderCode && (request.clientName ?? "").startsWith("Mostruário — ");
  const showAddress =
    !isStoreTarget && (type === "montagem" || type === "desmontagem" || type === "recolhimento" || type === "troca_peca" || type === "vistoria");
  const showAddressNumber = type === "montagem" || type === "desmontagem";
  const [isApartment, setIsApartment] = useState(request.clientIsApartment);
  const showItems = type !== "notificacao_externa";
  const showRestriction = type === "recolhimento" || type === "troca_peca" || type === "vistoria";
  const showCombo = type === "montagem" || type === "desmontagem";
  const primaryAction: "montar" | "desmontar" = type === "montagem" ? "montar" : "desmontar";

  const secondaryAction: "montar" | "desmontar" = primaryAction === "montar" ? "desmontar" : "montar";
  const blankItem: Item = { product: "", quantity: 1, code: "" };

  const [combo, setCombo] = useState(request.comboMontagemDesmontagem);
  const [items, setItems] = useState<Item[]>(() => {
    const list = request.items
      .filter((i) => i.action !== secondaryAction)
      .map((i) => ({ product: i.product, quantity: i.quantity, code: i.partCode ?? "" }));
    return list.length > 0 ? list : [blankItem];
  });
  const [secondaryItems, setSecondaryItems] = useState<Item[]>(() => {
    const list = request.items
      .filter((i) => i.action === secondaryAction)
      .map((i) => ({ product: i.product, quantity: i.quantity, code: i.partCode ?? "" }));
    return list.length > 0 ? list : [blankItem];
  });
  const [productLookupStatus, setProductLookupStatus] = useState<Record<number, ProductLookupStatus>>({});
  const [secondaryProductLookupStatus, setSecondaryProductLookupStatus] = useState<Record<number, ProductLookupStatus>>({});

  function makeItemHandlers(
    setList: React.Dispatch<React.SetStateAction<Item[]>>,
    setStatus: React.Dispatch<React.SetStateAction<Record<number, ProductLookupStatus>>>
  ) {
    function update(index: number, patch: Partial<Item>) {
      setList((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    }
    function add() {
      setList((prev) => [...prev, { product: "", quantity: 1, code: "" }]);
    }
    function remove(index: number) {
      setList((prev) => prev.filter((_, i) => i !== index));
    }
    function lookup(index: number, code: string) {
      if (!code.trim()) {
        setStatus((prev) => ({ ...prev, [index]: "idle" }));
        return;
      }
      setStatus((prev) => ({ ...prev, [index]: "loading" }));
      lookupTotvsProduct(code)
        .then((match) => {
          if (!match || !match.description) {
            setStatus((prev) => ({ ...prev, [index]: "not_found" }));
            return;
          }
          update(index, { product: match.description! });
          setStatus((prev) => ({ ...prev, [index]: "found" }));
        })
        .catch(() => setStatus((prev) => ({ ...prev, [index]: "not_found" })));
    }
    return { update, add, remove, lookup };
  }

  const primaryHandlers = makeItemHandlers(setItems, setProductLookupStatus);
  const secondaryHandlers = makeItemHandlers(setSecondaryItems, setSecondaryProductLookupStatus);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Prazo" number={1}>
        <Field label="Prazo desejado *">
          <input
            name="requested_deadline"
            type="date"
            required
            defaultValue={request.requestedDeadline ?? ""}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        {showCombo ? (
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              name="combo_montagem_desmontagem"
              checked={combo}
              onChange={(e) => setCombo(e.target.checked)}
              className="rounded"
            />
            {type === "montagem" ? "Também precisa desmontar o móvel antigo" : "Também precisa montar o móvel novo"}
          </label>
        ) : null}
      </FormSection>

      {!isStoreTarget ? (
        <FormSection title="Referência da venda" number={2} hint="Ajuda a localizar a compra depois.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Código do pedido/venda *">
              <input name="order_code" required defaultValue={request.orderCode ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
            <Field label="Nº da nota fiscal *">
              <input
                name="invoice_number"
                required
                defaultValue={request.invoiceNumber ?? ""}
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Vendedor(a) *">
            <input name="seller_name" required defaultValue={request.sellerName ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </FormSection>
      ) : null}

      {!isStoreTarget ? (
        <FormSection title="Dados do cliente" number={3}>
          <Field label="Nome do cliente *">
            <input name="client_name" required defaultValue={request.clientName ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="CPF do cliente *">
              <input name="client_cpf" required defaultValue={request.clientCpf ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
            <Field label="Telefone de contato *">
              <input name="client_phone" required defaultValue={request.clientPhone ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
          </div>

          {showAddress ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Endereço *">
                <input
                  name="client_address"
                  required
                  defaultValue={request.clientAddress ?? ""}
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                />
              </Field>
              <Field label="Bairro *">
                <input
                  name="client_neighborhood"
                  required
                  defaultValue={request.clientNeighborhood ?? ""}
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                />
              </Field>
            </div>
          ) : null}

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
        </FormSection>
      ) : null}

      {showItems ? (
        <FormSection
          title={combo ? `Produtos a ${type === "montagem" ? "montar" : "desmontar"}` : "Produtos"}
          number={4}
          hint="Digite o código do produto pra preencher o nome automaticamente (se souber)."
        >
          <ProductItemsFields
            items={items}
            lookupStatus={productLookupStatus}
            onUpdate={primaryHandlers.update}
            onAdd={primaryHandlers.add}
            onRemove={primaryHandlers.remove}
            onLookup={primaryHandlers.lookup}
            namePrefix="item"
          />
        </FormSection>
      ) : null}

      {showItems && combo ? (
        <FormSection title={`Produtos a ${type === "montagem" ? "desmontar" : "montar"}`} number={5}>
          <ProductItemsFields
            items={secondaryItems}
            lookupStatus={secondaryProductLookupStatus}
            onUpdate={secondaryHandlers.update}
            onAdd={secondaryHandlers.add}
            onRemove={secondaryHandlers.remove}
            onLookup={secondaryHandlers.lookup}
            namePrefix="item_secondary"
          />
        </FormSection>
      ) : null}

      <FormSection title="Motivo e observações" number={6}>
        <Field label="Motivo *">
          <textarea name="reason" rows={2} required defaultValue={request.reason ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        {showRestriction ? (
          <Field label="Restrição de horário / observação de recolhimento">
            <input
              name="restriction_note"
              defaultValue={request.restrictionNote ?? ""}
              placeholder="Ex: restrição após 15h, cliente já remarcada 2 vezes…"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        ) : null}

        <Field label="Observações">
          <textarea name="notes" rows={3} defaultValue={request.notes ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </FormSection>

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
