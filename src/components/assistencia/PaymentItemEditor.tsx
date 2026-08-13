"use client";

import { useState } from "react";
import Link from "next/link";
import { setItemUnitValue, setItemPaymentReleased, setItemPaymentAuthorizedBy } from "@/app/assistencia/pagamentos-actions";
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
  const [editingAuth, setEditingAuth] = useState(false);
  const [authValue, setAuthValue] = useState(item.paymentAuthorizedBy ?? "");

  const isConcluded = item.requestStatus === "concluida";
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

  function saveAuth() {
    if (!authValue.trim()) {
      showToast("Informe o nome do gerente.", "error");
      return;
    }
    run(async () => {
      await setItemPaymentAuthorizedBy(item.itemId, item.requestId, authValue);
      setEditingAuth(false);
    }, "Autorização registrada.");
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
          <Link href={`/assistencia/${item.requestId}`} className="text-sm min-w-0 hover:underline" style={{ color: "var(--text-primary)" }}>
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
                className="w-24 rounded border px-2 py-1 text-sm"
                style={{ borderColor: "var(--border)" }}
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
          ) : canEdit ? (
            <button onClick={() => setEditing(true)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              {total !== null ? formatBRL(total) : "definir valor"}
            </button>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {total !== null ? formatBRL(total) : "Sem valor definido"}
            </span>
          )}
          {isConcluded ? (
            canEdit ? (
              <button
                onClick={toggleReleased}
                disabled={pending}
                className="text-xs font-medium px-2.5 py-1 rounded-full border disabled:opacity-60 whitespace-nowrap"
                style={{
                  color: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
                  borderColor: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
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
          ) : (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
              title="Só é possível liberar o pagamento depois que a montagem for concluída."
            >
              A montar
            </span>
          )}
          {item.paymentReleased && item.paymentReleasedAt ? (
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              pago em {formatDate(item.paymentReleasedAt)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: "var(--text-muted)" }}>
        <span>
          {item.clientName ?? "Sem cliente"} · {item.storeName}
        </span>
        <span>·</span>
        <span>Autorizado por (gerente):</span>
        {editingAuth ? (
          <>
            <input
              value={authValue}
              onChange={(e) => setAuthValue(e.target.value)}
              className="w-40 rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
              autoFocus
            />
            <button
              disabled={pending}
              onClick={saveAuth}
              className="rounded px-2 py-1 disabled:opacity-60"
              style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
            >
              Salvar
            </button>
            <button onClick={() => setEditingAuth(false)} className="underline">
              cancelar
            </button>
          </>
        ) : canEdit ? (
          <button onClick={() => setEditingAuth(true)} className="underline" style={{ color: "var(--text-secondary)" }}>
            {item.paymentAuthorizedBy ?? "definir"}
          </button>
        ) : (
          <span>{item.paymentAuthorizedBy ?? "não definido"}</span>
        )}
      </div>
    </div>
  );
}
