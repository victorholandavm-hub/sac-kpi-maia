"use client";

import { useActionState, useState } from "react";
import { createPedidoFornecedorAction, type FormState } from "@/app/assistencia/fornecedor-pedido-actions";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

type Item = { produtoDescricao: string; quantidade: number };

export function NovoPedidoFornecedorForm({ suppliers }: { suppliers: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPedidoFornecedorAction, undefined);
  const [items, setItems] = useState<Item[]>([{ produtoDescricao: "", quantidade: 1 }]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { produtoDescricao: "", quantidade: 1 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Fornecedor *">
        <select name="fornecedor" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
          <option value="" disabled>
            Selecione…
          </option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          Produtos *
        </span>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              name="item_produto_descricao"
              type="text"
              value={item.produtoDescricao}
              onChange={(e) => updateItem(i, { produtoDescricao: e.target.value })}
              required
              placeholder="Nome do produto"
              className="flex-1 rounded border px-3 py-2"
              style={inputStyle}
            />
            <input
              name="item_quantidade"
              type="number"
              min={1}
              value={item.quantidade}
              onChange={(e) => updateItem(i, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })}
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
        <button type="button" onClick={addItem} className="text-sm self-start underline" style={{ color: "var(--text-secondary)" }}>
          + adicionar produto
        </button>
      </div>

      <Field label="Previsão de chegada (opcional)">
        <input name="expected_at" type="date" className="rounded border px-3 py-2" style={inputStyle} />
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
        {pending ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}
