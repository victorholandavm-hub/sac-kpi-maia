"use client";

import { useActionState, useEffect, useState } from "react";
import {
  editPedidoEncomendaAction,
  lookupTotvsClientForEncomenda,
  lookupTotvsProductForEncomenda,
  type FormState,
} from "@/app/assistencia/encomendas-actions";
import type { PedidoEncomendaSummary } from "@/lib/pedidosEncomenda";
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

type Item = { produtoDescricao: string; produtoCodigo: string; quantidade: number };
type ProductLookupStatus = "idle" | "loading" | "found" | "not_found";

export function EditPedidoEncomendaForm({ pedido }: { pedido: PedidoEncomendaSummary }) {
  const boundAction = editPedidoEncomendaAction.bind(null, pedido.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, undefined);
  const [items, setItems] = useState<Item[]>(
    pedido.items.map((i) => ({ produtoDescricao: i.produtoDescricao, produtoCodigo: i.produtoCodigo ?? "", quantidade: i.quantidade }))
  );
  const [productLookupStatus, setProductLookupStatus] = useState<Record<number, ProductLookupStatus>>({});

  function lookupItemProduct(index: number, code: string) {
    if (!code.trim()) {
      setProductLookupStatus((prev) => ({ ...prev, [index]: "idle" }));
      return;
    }
    setProductLookupStatus((prev) => ({ ...prev, [index]: "loading" }));
    lookupTotvsProductForEncomenda(code)
      .then((match) => {
        if (!match || !match.description) {
          setProductLookupStatus((prev) => ({ ...prev, [index]: "not_found" }));
          return;
        }
        updateItem(index, { produtoDescricao: match.description! });
        setProductLookupStatus((prev) => ({ ...prev, [index]: "found" }));
      })
      .catch(() => setProductLookupStatus((prev) => ({ ...prev, [index]: "not_found" })));
  }

  const [clienteCodigo, setClienteCodigo] = useState(pedido.clienteCodigo ?? "");
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [clienteLookupStatus, setClienteLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!clienteCodigo.trim()) {
        setClienteLookupStatus("idle");
        return;
      }
      setClienteLookupStatus("loading");
      lookupTotvsClientForEncomenda(clienteCodigo)
        .then((match) => {
          if (!match) {
            setClienteNome(null);
            setClienteLookupStatus("not_found");
            return;
          }
          setClienteNome(match.name);
          setClienteLookupStatus("found");
        })
        .catch(() => setClienteLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [clienteCodigo]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { produtoDescricao: "", produtoCodigo: "", quantidade: 1 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Cliente" number={1}>
        <Field label="Código do cliente *">
          <input
            name="cliente_codigo"
            value={clienteCodigo}
            onChange={(e) => setClienteCodigo(e.target.value)}
            required
            placeholder="Código do cliente na venda"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
          {clienteLookupStatus === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </span>
          ) : clienteLookupStatus === "found" ? (
            <span className="text-xs" style={{ color: "var(--status-good)" }}>
              Cliente encontrado: {clienteNome}
            </span>
          ) : clienteLookupStatus === "not_found" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Código não encontrado — pode salvar assim mesmo.
            </span>
          ) : null}
        </Field>
      </FormSection>

      <FormSection title="Produtos" number={2} hint="Digite o código do produto pra preencher o nome automaticamente (se souber).">
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  name="item_produto_codigo"
                  value={item.produtoCodigo}
                  onChange={(e) => updateItem(i, { produtoCodigo: e.target.value })}
                  onBlur={(e) => lookupItemProduct(i, e.target.value)}
                  placeholder="Código"
                  className="w-28 rounded border px-3 py-2"
                  style={inputStyle}
                />
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
              {productLookupStatus[i] === "loading" ? (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Buscando…
                </span>
              ) : productLookupStatus[i] === "not_found" ? (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Código não encontrado.
                </span>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-sm self-start underline" style={{ color: "var(--text-secondary)" }}>
            + adicionar produto
          </button>
        </div>
      </FormSection>

      <FormSection title="Detalhes" number={3}>
        <Field label="Vendedor responsável (opcional)">
          <input
            name="vendedor_name"
            defaultValue={pedido.vendedorName ?? ""}
            placeholder="Pra qual vendedor(a) é essa venda"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <Field label="Observações">
          <textarea name="notes" defaultValue={pedido.notes ?? ""} rows={3} className="rounded border px-3 py-2" style={inputStyle} />
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
