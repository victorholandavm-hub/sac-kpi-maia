"use client";

import { useActionState, useEffect, useState } from "react";
import { createPublicRequest, lookupTotvsClient, lookupTotvsProduct, type FormState } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SAC_CATEGORIES, SAC_CATEGORY_LABELS } from "@/lib/assistenciaLabels";
import type { Store } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

const TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria", "notificacao_externa"] as const;

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

// Compartilhado entre a lista de produtos normal e as duas listas (montar/
// desmontar) de uma solicitação combo -- mesma UI, fonte de dados diferente.
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

// `stores` já vem restrito às lojas do gerente autenticado (um gerente pode
// cuidar de mais de uma — ver src/lib/gerentes.ts e src/app/assistencia/solicitar/page.tsx,
// que exige sessão antes de renderizar este formulário). `requesterName` vem
// da mesma sessão (nome+PIN) — não pedimos de novo no formulário.
export function PublicRequestForm({ stores, requesterName }: { stores: Store[]; requesterName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPublicRequest, undefined);
  const [type, setType] = useState<(typeof TYPES)[number]>("montagem");
  // Montagem/desmontagem de móvel de mostruário da própria loja não tem
  // cliente, venda nem endereço pra pedir -- só faz sentido pra esses dois
  // tipos (ver isStoreTarget em createPublicRequest).
  const [target, setTarget] = useState<"cliente" | "loja">("cliente");
  const showTargetPicker = type === "montagem" || type === "desmontagem";
  const isStoreTarget = showTargetPicker && target === "loja";
  const [items, setItems] = useState<Item[]>([{ product: "", quantity: 1, code: "" }]);
  const [productLookupStatus, setProductLookupStatus] = useState<Record<number, ProductLookupStatus>>({});
  // Combo (montagem + desmontagem na mesma visita) precisa de duas listas de
  // produto separadas -- essa aqui é só a da ação oposta ao type escolhido
  // (ver primaryAction/secondaryAction em createPublicRequest).
  const [combo, setCombo] = useState(false);
  const [secondaryItems, setSecondaryItems] = useState<Item[]>([{ product: "", quantity: 1, code: "" }]);
  const [secondaryProductLookupStatus, setSecondaryProductLookupStatus] = useState<Record<number, ProductLookupStatus>>({});

  // Busca ao sair do campo (não debounced feito o do cliente) -- são vários
  // itens, um timer por linha complicaria mais do que ajuda; digitar o
  // código e sair do campo já é rápido o suficiente. Uma função de fábrica
  // porque a mesma lógica serve pra lista normal e pra lista secundária do combo.
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

  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCpf, setClientCpf] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientNeighborhood, setClientNeighborhood] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  // Busca o cliente pelo código pra autopreencher nome/CPF/telefone (dado
  // confiável) e sugerir endereço (editável -- o cliente pode ter mudado).
  // Não trava nada: se não achar, a pessoa preenche tudo à mão como já era.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!clientCode.trim()) {
        setLookupStatus("idle");
        return;
      }
      setLookupStatus("loading");
      lookupTotvsClient(clientCode)
        .then((match) => {
          if (!match) {
            setLookupStatus("not_found");
            return;
          }
          setClientName(match.name);
          setClientCpf(match.cpfCnpj);
          if (match.phone1) setClientPhone(match.phone1);
          const addressParts = [match.addressStreet, match.addressNumber].filter(Boolean).join(", ");
          if (addressParts) setClientAddress(match.addressComplement ? `${addressParts} — ${match.addressComplement}` : addressParts);
          if (match.addressNeighborhood) setClientNeighborhood(match.addressNeighborhood);
          setLookupStatus("found");
        })
        .catch(() => setLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [clientCode]);

  const showAddress =
    !isStoreTarget &&
    (type === "montagem" || type === "desmontagem" || type === "recolhimento" || type === "troca_peca" || type === "vistoria");
  const showItems = type !== "notificacao_externa";
  const showRestriction = type === "recolhimento" || type === "troca_peca" || type === "vistoria";
  const showCombo = type === "montagem" || type === "desmontagem";

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Loja e prazo" number={1} hint="Quando você precisa que isso seja resolvido?">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Solicitante">
            <input
              value={requesterName}
              disabled
              className="rounded border px-3 py-2"
              style={{ ...inputStyle, background: "var(--gridline)", color: "var(--text-secondary)" }}
            />
            <input type="hidden" name="requested_by_name" value={requesterName} />
          </Field>
          <Field label="Loja solicitante *">
            {stores.length === 1 ? (
              <>
                <input
                  value={stores[0].name}
                  disabled
                  className="rounded border px-3 py-2"
                  style={{ ...inputStyle, background: "var(--gridline)", color: "var(--text-secondary)" }}
                />
                <input type="hidden" name="store_id" value={stores[0].id} />
              </>
            ) : (
              <select name="store_id" required className="rounded border px-3 py-2" style={inputStyle} defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field label="Prazo desejado *">
          <input name="requested_deadline" type="date" required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </FormSection>

      <FormSection title="Tipo de solicitação" number={2} hint="O tipo muda quais campos aparecem a seguir.">
        <Field label="Tipo de solicitação">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
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

        {showTargetPicker ? (
          <Field label="Para quem é?">
            <select
              name="request_target"
              value={target}
              onChange={(e) => setTarget(e.target.value as "cliente" | "loja")}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              <option value="cliente">Cliente</option>
              <option value="loja">Mostruário da própria loja</option>
            </select>
          </Field>
        ) : null}

        {type === "notificacao_externa" ? (
          <Field label="Categoria da notificação *">
            <select name="sac_category" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
              <option value="" disabled>
                Selecione…
              </option>
              {SAC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SAC_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </FormSection>

      {!isStoreTarget ? (
        <FormSection title="Referência da venda" number={3} hint="Ajuda a localizar a compra depois.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Código do pedido/venda *">
              <input name="order_code" required className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
            <Field label="Nº da nota fiscal *">
              <input name="invoice_number" required className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
          </div>

          <Field label="Vendedor(a) *">
            <input name="seller_name" required className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </FormSection>
      ) : null}

      {isStoreTarget ? (
        <FormSection title="Dados do cliente" number={4}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Sem cliente nessa solicitação — é montagem/desmontagem de móvel de mostruário da própria loja.
          </p>
        </FormSection>
      ) : (
      <FormSection
        title="Dados do cliente"
        number={4}
        hint="Digite o código do cliente pra preencher o resto automaticamente (se souber)."
      >
        <Field label="Código do cliente">
          <input
            name="client_protheus_code"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
          {lookupStatus === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </span>
          ) : lookupStatus === "found" ? (
            <span className="text-xs" style={{ color: "var(--status-good)" }}>
              Cliente encontrado — confira os dados abaixo.
            </span>
          ) : lookupStatus === "not_found" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Código não encontrado — preencha os dados abaixo à mão.
            </span>
          ) : null}
        </Field>

        <Field label="Nome do cliente *">
          <input
            name="client_name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="CPF do cliente *">
            <input
              name="client_cpf"
              value={clientCpf}
              onChange={(e) => setClientCpf(e.target.value)}
              required
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
          <Field label="Telefone de contato *">
            <input
              name="client_phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              required
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        </div>

        {showAddress ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Endereço *">
              <input
                name="client_address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                required
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
            <Field label="Bairro *">
              <input
                name="client_neighborhood"
                value={clientNeighborhood}
                onChange={(e) => setClientNeighborhood(e.target.value)}
                required
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
          </div>
        ) : null}
      </FormSection>
      )}

      {showItems ? (
        <FormSection
          title={combo ? `Produtos a ${type === "montagem" ? "montar" : "desmontar"}` : "Produtos"}
          number={5}
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
        <FormSection title={`Produtos a ${type === "montagem" ? "desmontar" : "montar"}`} number={6}>
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

      <FormSection title="Motivo e observações" number={7} hint="Conte o que precisa ser feito, com o máximo de detalhe que puder.">
        <Field label="Motivo *">
          <textarea name="reason" rows={2} required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        {showRestriction ? (
          <Field label="Restrição de horário / observação de recolhimento">
            <input
              name="restriction_note"
              placeholder="Ex: restrição após 15h, cliente já remarcada 2 vezes…"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        ) : null}

        <Field label="Observações">
          <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
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
        {pending ? "Enviando…" : "Enviar solicitação"}
      </button>
    </form>
  );
}
