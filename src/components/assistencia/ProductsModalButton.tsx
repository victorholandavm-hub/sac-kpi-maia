"use client";

import { useState } from "react";

type ModalItem = {
  product: string;
  quantity: number;
  partCode?: string | null;
  action?: "montar" | "desmontar" | null;
};

const ACTION_LABELS: Record<"montar" | "desmontar", string> = { montar: "montar", desmontar: "desmontar" };

// Botão + modal com a lista completa de produtos -- alternativa ao resumo
// truncado que ficava direto no card (poluía a fila quando tinha combo
// montagem+desmontagem com vários itens). Usado tanto na fila da assistência
// quanto na tela da loja -- montador continua vendo a lista direto, sem
// modal (RequestItemsTable.tsx não muda).
export function ProductsModalButton({ items }: { items: ModalItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap underline"
        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--text-secondary) 15%, var(--surface-1))" }}
      >
        📦 Ver produtos ({items.length})
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar lista de produtos"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-sm max-h-[65vh] overflow-y-auto rounded-lg border p-4 shadow-lg"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Produtos ({items.length})
              </h3>
              <button
                aria-label="Fechar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((item, i) => (
                <li key={i} className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {item.quantity > 1 ? `${item.quantity}x ` : ""}
                  {item.product}
                  {item.partCode ? <span style={{ color: "var(--text-muted)" }}> · cód. {item.partCode}</span> : null}
                  {item.action ? <span style={{ color: "var(--text-secondary)" }}> — {ACTION_LABELS[item.action]}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
