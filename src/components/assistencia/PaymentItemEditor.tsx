"use client";

import { useState } from "react";
import Link from "next/link";
import { setItemUnitValue, setItemPaymentReleased } from "@/app/assistencia/pagamentos-actions";
import { useQuickAction } from "./useQuickAction";
import type { PaymentItem } from "@/lib/payments";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Linha de item na tela de Pagamentos, com valor/aprovação/autorização
// editáveis ali mesmo -- mesmo comportamento de ItemRow em
// RequestItemsTable.tsx (mesmas server actions, mesmas regras: só libera
// pagamento depois de concluída), só que adaptado pro formato "achatado"
// entre solicitações (PaymentItem) em vez do item de uma solicitação só.
// Existir separado da versão em RequestItemsTable é o preço de UI de listas
// achatadas x aninhadas -- não dava pra reaproveitar o componente sem
// reconciliar os dois formatos de dado.
//
// `checked`/`onToggle` só vêm preenchidos quando o item é elegível pra
// seleção em lote (concluída, com valor, ainda não paga -- ver
// AssemblerPaymentGroup.tsx) -- os outros casos (a montar, já pago) não
// mostram checkbox, porque marcar em lote só faz sentido pra quem ainda
// está pendente.
export function PaymentItemEditor({
  item,
  canEdit,
  checked,
  onToggle,
}: {
  item: PaymentItem;
  canEdit: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  const { pending, run, showToast } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.unitValue !== null ? String(item.unitValue) : "");

  const isConcluded = item.requestStatus === "concluida";
  // Montador já marcou como feito, mas o gerente da loja ainda não aprovou
  // -- só a partir da aprovação (status vira "concluida") é que o Antonio
  // pode definir valor/liberar pagamento. Até lá, aparece na lista (pra não
  // sumir sem explicação), só sem a opção de mexer em valor.
  const isAwaitingApproval = item.requestStatus === "aguardando_aprovacao";
  const total = item.unitValue !== null ? item.unitValue * item.quantity : null;

  function saveValue() {
    const parsed = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("Valor inválido.", "error");
      return;
    }
    run(async () => {
      await setItemUnitValue(item.itemId, item.requestId, parsed);
      setEditing(false);
    }, "Valor atualizado.");
  }

  function toggleReleased() {
    run(
      () => setItemPaymentReleased(item.itemId, item.requestId, !item.paymentReleased),
      item.paymentReleased ? "Pagamento revertido para pendente." : "Pagamento marcado como pago."
    );
  }

  return (
    <div className="flex flex-col gap-1.5 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2 min-w-0">
          {onToggle ? (
            <input
              type="checkbox"
              checked={checked ?? false}
              onChange={onToggle}
              className="rounded shrink-0"
              aria-label={`Selecionar ${item.product}`}
            />
          ) : null}
          <Link href={`/assistencia/${item.requestId}`} className="text-sm min-w-0 hover:underline text-gray-800 dark:text-gray-100">
            {item.quantity > 1 ? `${item.quantity}x ` : ""}
            {item.product}
          </Link>
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {editing ? (
            <>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Valor unit."
                className="w-24 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-sm"
                autoFocus
              />
              <button
                disabled={pending}
                onClick={saveValue}
                className="text-xs rounded px-2 py-1 disabled:opacity-60"
                style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
              >
                Salvar
              </button>
            </>
          ) : canEdit && !isAwaitingApproval ? (
            <button onClick={() => setEditing(true)} className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              {total !== null ? formatBRL(total) : "definir valor"}
            </button>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">{total !== null ? formatBRL(total) : "Sem valor definido"}</span>
          )}
          {isConcluded ? (
            canEdit ? (
              <button
                onClick={toggleReleased}
                disabled={pending}
                title={item.paymentReleased ? "Clique pra reverter pra pendente" : undefined}
                className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-60 whitespace-nowrap shadow-sm"
                style={{
                  color: item.paymentReleased ? "#fff" : "var(--brand-green-ink)",
                  background: item.paymentReleased ? "var(--status-good)" : "var(--brand-green)",
                }}
              >
                {item.paymentReleased ? "✓ Pago" : "Marcar como pago"}
              </button>
            ) : (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap"
                style={{
                  color: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
                  borderColor: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
                }}
              >
                {item.paymentReleased ? "✓ Pago" : "Pendente"}
              </span>
            )
          ) : isAwaitingApproval ? (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap"
              style={{ color: "var(--series-3)", borderColor: "var(--series-3)" }}
              title="O montador marcou como concluído, esperando o gerente da loja confirmar."
            >
              Aguardando aprovação do gerente
            </span>
          ) : (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 whitespace-nowrap"
              title="Só é possível liberar o pagamento depois que a montagem for concluída."
            >
              A montar
            </span>
          )}
          {item.paymentReleased && item.paymentReleasedAt ? (
            <span className="text-xs whitespace-nowrap text-gray-400 dark:text-gray-500">pago em {formatDate(item.paymentReleasedAt)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400 dark:text-gray-500">
        <span>
          {item.clientName ?? "Sem cliente"} · {item.storeName}
        </span>
      </div>
    </div>
  );
}
