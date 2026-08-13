"use client";

import { useState } from "react";
import { PaymentItemEditor } from "./PaymentItemEditor";
import { setItemPaymentReleased } from "@/app/assistencia/pagamentos-actions";
import { useQuickAction } from "./useQuickAction";
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
  const { pending, run } = useQuickAction();
  // Só entra na seleção em lote quem já está concluída, com valor definido e
  // ainda não paga -- é exatamente quem tem o botão "Marcar como pago"
  // individual, agora selecionável em lote também.
  const eligibleIds = items.filter((i) => i.requestStatus === "concluida" && i.unitValue !== null && !i.paymentReleased).map((i) => i.itemId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function markSelectedAsPaid() {
    const targets = items.filter((i) => selected.has(i.itemId));
    if (targets.length === 0) return;
    run(async () => {
      await Promise.all(targets.map((i) => setItemPaymentReleased(i.itemId, i.requestId, true)));
      setSelected(new Set());
    }, `${targets.length} pagamento${targets.length > 1 ? "s" : ""} marcado${targets.length > 1 ? "s" : ""} como pago.`);
  }

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
      {open && canEdit && eligibleIds.length > 0 ? (
        <div
          className="flex items-center gap-3 px-4 py-2 flex-wrap"
          style={{ background: "var(--surface-2, var(--gridline))", borderBottom: "1px solid var(--gridline)" }}
        >
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={selected.size === eligibleIds.length}
              onChange={() => setSelected(selected.size === eligibleIds.length ? new Set() : new Set(eligibleIds))}
              className="rounded"
            />
            Selecionar todos pendentes ({eligibleIds.length})
          </label>
          {selected.size > 0 ? (
            <>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selected.size} selecionado{selected.size > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={markSelectedAsPaid}
                disabled={pending}
                className="text-xs rounded px-2.5 py-1 font-medium disabled:opacity-60"
                style={{ background: "var(--status-good)", color: "#fff" }}
              >
                {pending ? "Marcando…" : "Marcar como pago"}
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
                limpar seleção
              </button>
            </>
          ) : null}
        </div>
      ) : null}
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
                  <PaymentItemEditor
                    key={item.itemId}
                    item={item}
                    canEdit={canEdit}
                    checked={canEdit && eligibleIds.includes(item.itemId) ? selected.has(item.itemId) : undefined}
                    onToggle={canEdit && eligibleIds.includes(item.itemId) ? () => toggle(item.itemId) : undefined}
                  />
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}
