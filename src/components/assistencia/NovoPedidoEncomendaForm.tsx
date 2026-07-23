"use client";

import { useActionState, useState } from "react";
import { createPedidoEncomendaAction, type FormState } from "@/app/assistencia/encomendas-actions";
import type { ProdutoEncomenda } from "@/lib/pedidosEncomenda";
import type { EncomendaRequester } from "@/lib/encomendaRequester";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

type Item = { produtoId: string; quantidade: number };

export function NovoPedidoEncomendaForm({
  requester,
  fixedStoreName,
  storeOptions,
  produtos,
  vendedorNames,
}: {
  requester: EncomendaRequester;
  fixedStoreName?: string;
  storeOptions?: { id: string; name: string }[];
  produtos: ProdutoEncomenda[];
  vendedorNames: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPedidoEncomendaAction, undefined);
  const [items, setItems] = useState<Item[]>([{ produtoId: "", quantidade: 1 }]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { produtoId: "", quantidade: 1 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {storeOptions ? (
        <Field label="Loja *">
          <select name="store_id" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
            <option value="" disabled>
              Selecione…
            </option>
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Loja">
          <input
            value={fixedStoreName}
            disabled
            className="rounded border px-3 py-2"
            style={{ ...inputStyle, background: "var(--surface-1)", color: "var(--text-secondary)" }}
          />
        </Field>
      )}

      {requester.kind === "caixa" ? (
        <Field label="Seu nome *">
          <input name="requester_name" required placeholder="Quem está lançando esse pedido" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          Produtos *
        </span>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              name="item_produto_id"
              value={item.produtoId}
              onChange={(e) => updateItem(i, { produtoId: e.target.value })}
              required
              className="flex-1 rounded border px-3 py-2"
              style={inputStyle}
            >
              <option value="" disabled>
                Selecione o produto…
              </option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descricao}
                </option>
              ))}
            </select>
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
        {produtos.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--status-warning)" }}>
            Nenhum produto cadastrado ainda — peça pro admin cadastrar o catálogo em /assistencia/admin.
          </p>
        ) : null}
      </div>

      <Field label="Vendedor responsável (opcional)">
        <input
          name="vendedor_name"
          list="vendedor-names"
          defaultValue={requester.kind === "vendedor" ? requester.name : ""}
          placeholder="Pra qual vendedor(a) é essa venda"
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
        <datalist id="vendedor-names">
          {vendedorNames.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </Field>

      <Field label="Observações">
        <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Foto do cupom fiscal">
        <input
          name="cupom_fiscal"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          className="rounded border px-3 py-2 text-sm"
          style={inputStyle}
        />
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
