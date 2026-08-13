"use client";

import { useState } from "react";
import { PaymentItemEditor } from "./PaymentItemEditor";
import { setItemPaymentReleased } from "@/app/assistencia/pagamentos-actions";
import { useQuickAction } from "./useQuickAction";
import type { PaymentItem } from "@/lib/payments";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function itemTotal(item: PaymentItem): number {
  return (item.unitValue ?? 0) * item.quantity;
}

function sumTotal(items: PaymentItem[]): number {
  return items.reduce((sum, i) => sum + itemTotal(i), 0);
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

type Tab = "pendentes" | "pagos";

// Card recolhido por padrão (a menos que esse montador já esteja filtrado
// ou seja o único grupo na tela) -- clica no nome pra abrir e ver as
// montagens, divididas por loja. Sem isso, a tela de "Todos" virava uma
// rolagem enorme com todo mundo aberto de uma vez, e pra ver o segundo
// montador tinha que descer passando pelas montagens inteiras do primeiro.
//
// Dentro do card, "Pendentes de pagamento" e "Pagos" ficam em abas
// separadas (não misturadas na mesma lista) -- pedido do usuário
// 13/08/2026: antes tudo vinha junto, dificultando ver de cara quanto
// ainda falta pagar de quanto já foi pago. "Pendentes" inclui tanto quem
// já pode ser pago (concluída, só falta o Antonio marcar) quanto quem
// ainda nem foi montado (não é pagável ainda, mas ainda conta como "falta
// pagar" no total dessa aba) -- só "Pagos" é estritamente payment_released.
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
  const [tab, setTab] = useState<Tab>("pendentes");
  const { pending, run } = useQuickAction();

  const pendentesItems = items.filter((i) => !i.paymentReleased);
  const pagosItems = items.filter((i) => i.paymentReleased);
  const pendentesTotal = sumTotal(pendentesItems);
  const pagosTotal = sumTotal(pagosItems);

  // Só entra na seleção em lote quem já está concluída, com valor definido e
  // ainda não paga -- é exatamente quem tem o botão "Marcar como pago"
  // individual, agora selecionável em lote também. Sempre um subconjunto da
  // aba "Pendentes" (quem já foi pago não aparece lá pra selecionar de novo).
  const eligibleIds = pendentesItems.filter((i) => i.requestStatus === "concluida" && i.unitValue !== null).map((i) => i.itemId);
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

  const activeItems = tab === "pendentes" ? pendentesItems : pagosItems;
  const storeGroups = groupByStore(activeItems);

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

      {open ? (
        <div className="flex items-stretch" style={{ borderBottom: "1px solid var(--gridline)" }}>
          <button
            type="button"
            onClick={() => setTab("pendentes")}
            className="flex-1 flex flex-col items-center gap-0.5 px-3 py-2"
            style={{
              background: tab === "pendentes" ? "color-mix(in srgb, var(--status-warning) 15%, var(--surface-1))" : "transparent",
              borderBottom: tab === "pendentes" ? "3px solid var(--status-warning)" : "3px solid transparent",
            }}
          >
            <span className="text-xs font-bold" style={{ color: tab === "pendentes" ? "var(--status-warning)" : "var(--text-secondary)" }}>
              Pendentes de pagamento ({pendentesItems.length})
            </span>
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {formatBRL(pendentesTotal)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("pagos")}
            className="flex-1 flex flex-col items-center gap-0.5 px-3 py-2"
            style={{
              background: tab === "pagos" ? "color-mix(in srgb, var(--status-good) 15%, var(--surface-1))" : "transparent",
              borderBottom: tab === "pagos" ? "3px solid var(--status-good)" : "3px solid transparent",
            }}
          >
            <span className="text-xs font-bold" style={{ color: tab === "pagos" ? "var(--status-good)" : "var(--text-secondary)" }}>
              Pagos ({pagosItems.length})
            </span>
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {formatBRL(pagosTotal)}
            </span>
          </button>
        </div>
      ) : null}

      {open && tab === "pendentes" && canEdit && eligibleIds.length > 0 ? (
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
            Selecionar todos pagáveis ({eligibleIds.length})
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
                className="text-xs rounded-lg px-3 py-1.5 font-bold disabled:opacity-60 shadow-sm"
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
        ? (storeGroups.length === 0 ? (
            <p className="px-4 py-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>
              {tab === "pendentes" ? "Nada pendente de pagamento." : "Nada pago ainda."}
            </p>
          ) : (
            storeGroups.map((storeGroup) => (
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
                      checked={canEdit && tab === "pendentes" && eligibleIds.includes(item.itemId) ? selected.has(item.itemId) : undefined}
                      onToggle={canEdit && tab === "pendentes" && eligibleIds.includes(item.itemId) ? () => toggle(item.itemId) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))
          ))
        : null}
    </div>
  );
}
