"use client";

import { useActionState, useState } from "react";
import { createPublicRequest, type FormState } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SAC_CATEGORIES, SAC_CATEGORY_LABELS } from "@/lib/assistenciaLabels";
import type { Store } from "@/lib/serviceRequests";

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

type Item = { product: string; quantity: number };

// `stores` já vem restrito às lojas do gerente autenticado (um gerente pode
// cuidar de mais de uma — ver src/lib/gerentes.ts e src/app/assistencia/solicitar/page.tsx,
// que exige sessão antes de renderizar este formulário). `requesterName` vem
// da mesma sessão (nome+PIN) — não pedimos de novo no formulário.
export function PublicRequestForm({ stores, requesterName }: { stores: Store[]; requesterName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPublicRequest, undefined);
  const [type, setType] = useState<(typeof TYPES)[number]>("montagem");
  const [items, setItems] = useState<Item[]>([{ product: "", quantity: 1 }]);

  const showAddress =
    type === "montagem" || type === "desmontagem" || type === "recolhimento" || type === "troca_peca" || type === "vistoria";
  const showItems = type !== "notificacao_externa";
  const showRestriction = type === "recolhimento" || type === "troca_peca" || type === "vistoria";
  const showCombo = type === "montagem" || type === "desmontagem";

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { product: "", quantity: 1 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Solicitante">
          <input
            value={requesterName}
            disabled
            className="rounded border px-3 py-2"
            style={{ ...inputStyle, background: "var(--surface-1)", color: "var(--text-secondary)" }}
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
                style={{ ...inputStyle, background: "var(--surface-1)", color: "var(--text-secondary)" }}
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
          <input type="checkbox" name="combo_montagem_desmontagem" className="rounded" />
          {type === "montagem" ? "Também precisa desmontar o móvel antigo" : "Também precisa montar o móvel novo"}
        </label>
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

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Código do pedido/venda">
          <input name="order_code" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Nº da nota fiscal">
          <input name="invoice_number" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Vendedor(a)">
        <input name="seller_name" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Nome do cliente *">
        <input name="client_name" required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="CPF do cliente">
        <input name="client_cpf" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Telefone de contato">
        <input name="client_phone" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {showAddress ? (
        <>
          <Field label="Endereço">
            <input name="client_address" className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Bairro">
            <input name="client_neighborhood" className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </>
      ) : null}

      {showItems ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Produtos *
          </span>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                name="item_product"
                value={item.product}
                onChange={(e) => updateItem(i, { product: e.target.value })}
                placeholder="Ex: Roupeiro Giardino"
                className="flex-1 rounded border px-3 py-2"
                style={inputStyle}
              />
              <input
                name="item_quantity"
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateItem(i, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-20 rounded border px-3 py-2"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                className="text-sm px-2 py-2 disabled:opacity-40"
                style={{ color: "var(--status-critical)" }}
                aria-label="Remover item"
              >
                remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-sm self-start underline"
            style={{ color: "var(--text-secondary)" }}
          >
            + adicionar produto
          </button>
        </div>
      ) : null}

      <Field label="Motivo">
        <textarea name="reason" rows={2} className="rounded border px-3 py-2" style={inputStyle} />
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
