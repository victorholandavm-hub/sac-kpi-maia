"use client";

import { useState } from "react";
import { setItemUnitValue, setItemPaymentReleased, setItemPaymentAuthorizedBy } from "@/app/assistencia/pagamentos-actions";
import { addRequestItemByStaff, removeRequestItemByStaff } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import type { RequestItem } from "@/lib/serviceRequests";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function ItemRow({
  item,
  requestId,
  requestStatus,
  canEditValues,
  canEditItems,
}: {
  item: RequestItem;
  requestId: string;
  requestStatus: string;
  canEditValues: boolean;
  canEditItems: boolean;
}) {
  const isConcluded = requestStatus === "concluida";
  const { pending, run, showToast } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.unitValue !== null ? String(item.unitValue) : "");
  const [editingAuth, setEditingAuth] = useState(false);
  const [authValue, setAuthValue] = useState(item.paymentAuthorizedBy ?? "");

  const total = item.unitValue !== null ? item.unitValue * item.quantity : null;

  function remove() {
    if (!window.confirm(`Remover "${item.product}" desse chamado?`)) return;
    run(() => removeRequestItemByStaff(requestId, item.id), "Produto removido.");
  }

  function saveValue() {
    const parsed = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("Valor inválido.", "error");
      return;
    }
    run(async () => {
      await setItemUnitValue(item.id, requestId, parsed);
      setEditing(false);
    }, "Valor atualizado.");
  }

  function toggleReleased() {
    run(
      () => setItemPaymentReleased(item.id, requestId, !item.paymentReleased),
      item.paymentReleased ? "Pagamento revertido para pendente." : "Pagamento aprovado."
    );
  }

  function saveAuth() {
    if (!authValue.trim()) {
      showToast("Informe o nome do gerente.", "error");
      return;
    }
    run(async () => {
      await setItemPaymentAuthorizedBy(item.id, requestId, authValue);
      setEditingAuth(false);
    }, "Autorização registrada.");
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 flex-wrap" style={{ borderTop: "1px solid var(--gridline)" }}>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {item.action ? (
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded mr-1.5"
            style={{
              color: item.action === "montar" ? "var(--brand-green-ink)" : "var(--text-primary)",
              background: item.action === "montar" ? "var(--brand-green)" : "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))",
            }}
          >
            {item.action === "montar" ? "Montar" : "Desmontar"}
          </span>
        ) : null}
        {item.quantity > 1 ? `${item.quantity}x ` : ""}
        {item.product}
        {item.partCode ? <span style={{ color: "var(--text-muted)" }}> · cód. {item.partCode}</span> : null}
        {canEditItems ? (
          <button
            onClick={remove}
            disabled={pending}
            className="text-xs underline ml-2 disabled:opacity-60"
            style={{ color: "var(--status-critical)" }}
          >
            remover
          </button>
        ) : null}
      </span>
      <div className="flex items-center gap-3">
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
        ) : canEditValues ? (
          <button onClick={() => setEditing(true)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            {total !== null ? formatBRL(total) : "definir valor"}
          </button>
        ) : (
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {total !== null ? formatBRL(total) : "Sem valor definido"}
          </span>
        )}
        {isConcluded ? (
          canEditValues ? (
            <button
              onClick={toggleReleased}
              disabled={pending}
              className="text-xs font-medium px-2.5 py-1 rounded-full border disabled:opacity-60 whitespace-nowrap"
              style={{
                color: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
                borderColor: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
              }}
            >
              {item.paymentReleased ? "✓ Aprovado" : "Aprovar pagamento"}
            </button>
          ) : (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap"
              style={{
                color: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
                borderColor: item.paymentReleased ? "var(--status-good)" : "var(--status-warning)",
              }}
            >
              {item.paymentReleased ? "✓ Aprovado" : "Pendente"}
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
            em {formatDate(item.paymentReleasedAt)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 w-full text-xs" style={{ color: "var(--text-muted)" }}>
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
        ) : canEditValues ? (
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

// Só assistência/admin vê isso (canEditItems) -- montador em loja pede pra
// ajustar montagem/desmontagem na hora, e a assistência precisa conseguir
// adicionar/remover produto sem depender do gerente reabrir a solicitação
// (que só funciona enquanto o status ainda é "aberta", ver
// editServiceRequestByGerente em actions.ts).
function AddItemForm({ requestId, requestType }: { requestId: string; requestType: string }) {
  const { pending, run, showToast } = useQuickAction();
  const showAction = requestType === "montagem" || requestType === "desmontagem";
  const [product, setProduct] = useState("");
  const [partCode, setPartCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [action, setAction] = useState<"" | "montar" | "desmontar">(showAction ? "montar" : "");

  function add() {
    if (!product.trim()) {
      showToast("Informe o produto.", "error");
      return;
    }
    run(async () => {
      await addRequestItemByStaff(requestId, {
        product,
        partCode: partCode || undefined,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        action: showAction ? action || null : null,
      });
      setProduct("");
      setPartCode("");
      setQuantity("1");
    }, "Produto adicionado.");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <input
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        placeholder="Produto"
        className="rounded border px-2 py-1 text-sm flex-1 min-w-[140px]"
        style={{ borderColor: "var(--border)" }}
      />
      <input
        value={partCode}
        onChange={(e) => setPartCode(e.target.value)}
        placeholder="Código (opcional)"
        className="rounded border px-2 py-1 text-sm w-32"
        style={{ borderColor: "var(--border)" }}
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        type="number"
        min={1}
        className="rounded border px-2 py-1 text-sm w-16"
        style={{ borderColor: "var(--border)" }}
      />
      {showAction ? (
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as "montar" | "desmontar")}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="montar">Montar</option>
          <option value="desmontar">Desmontar</option>
        </select>
      ) : null}
      <button
        onClick={add}
        disabled={pending}
        className="text-xs rounded px-2 py-1.5 font-medium disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        + Adicionar produto
      </button>
    </div>
  );
}

export function RequestItemsTable({
  items,
  requestId,
  requestStatus,
  requestType,
  canEditValues,
  canEditItems,
}: {
  items: RequestItem[];
  requestId: string;
  requestStatus: string;
  requestType: string;
  canEditValues: boolean;
  canEditItems: boolean;
}) {
  if (items.length === 0 && !canEditItems) return null;
  const total = items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Produtos
        </span>
        {total > 0 ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Total: {formatBRL(total)}
          </span>
        ) : null}
      </div>
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          requestId={requestId}
          requestStatus={requestStatus}
          canEditValues={canEditValues}
          canEditItems={canEditItems}
        />
      ))}
      {canEditItems ? <AddItemForm requestId={requestId} requestType={requestType} /> : null}
    </div>
  );
}
