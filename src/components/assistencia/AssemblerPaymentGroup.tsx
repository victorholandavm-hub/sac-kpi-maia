"use client";

import { useState } from "react";
import { PaymentItemEditor } from "./PaymentItemEditor";
import type { PaymentItem } from "@/lib/payments";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function groupByStore(items: PaymentItem[]) {
  const groups: { storeName: string; items: PaymentItem[] }[] = [];
  for (const item of items) {
    const name = item.storeName || "Sem loja";
    let group = groups.find((g) => g.storeName === name);
    if (!group) {
      group = { storeName: name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups.sort((a, b) => a.storeName.localeCompare(b.storeName));
}

// Card recolhido por padrão (a menos que esse montador já esteja filtrado
// ou seja o único grupo na tela) -- clica no nome pra abrir e ver as
// montagens, divididas por loja. Sem isso, a tela de "Todos" virava uma
// rolagem enorme com todo mundo aberto de uma vez, e pra ver o segundo
// montador tinha que descer passando pelas montagens inteiras do primeiro.
export function AssemblerPaymentGroup({
  assemblerName,
  items,
  total,
  canEdit,
  defaultOpen,
}: {
  assemblerName: string;
  items: PaymentItem[];
  total: number;
  canEdit: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const storeGroups = groupByStore(items);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-3 px-4 py-3 w-full text-left"
        style={open ? { borderBottom: "1px solid var(--gridline)" } : undefined}
      >
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          <span aria-hidden style={{ color: "var(--brand-green)" }}>
            {open ? "▾" : "▸"}
          </span>
          {assemblerName}
          <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
            ({items.length} {items.length === 1 ? "item" : "itens"})
          </span>
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {formatBRL(total)}
        </span>
      </button>
      {open
        ? storeGroups.map((storeGroup) => (
            <div key={storeGroup.storeName}>
              <div className="px-4 py-1.5" style={{ background: "var(--surface-2, var(--gridline))" }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  {storeGroup.storeName}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {storeGroup.items.map((item) => (
                  <PaymentItemEditor key={item.itemId} item={item} canEdit={canEdit} />
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}
