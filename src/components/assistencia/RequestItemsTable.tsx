"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setItemUnitValue, setItemPaymentReleased, setItemPaymentAuthorizedBy } from "@/app/assistencia/pagamentos-actions";
import type { RequestItem } from "@/lib/serviceRequests";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function ItemRow({ item, requestId }: { item: RequestItem; requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.unitValue !== null ? String(item.unitValue) : "");
  const [error, setError] = useState<string | null>(null);
  const [editingAuth, setEditingAuth] = useState(false);
  const [authValue, setAuthValue] = useState(item.paymentAuthorizedBy ?? "");

  const total = item.unitValue !== null ? item.unitValue * item.quantity : null;

  function saveValue() {
    const parsed = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Valor inválido.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await setItemUnitValue(item.id, requestId, parsed);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    });
  }

  function toggleReleased() {
    startTransition(async () => {
      try {
        await setItemPaymentReleased(item.id, requestId, !item.paymentReleased);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    });
  }

  function saveAuth() {
    if (!authValue.trim()) {
      setError("Informe o nome do gerente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await setItemPaymentAuthorizedBy(item.id, requestId, authValue);
        setEditingAuth(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 flex-wrap" style={{ borderTop: "1px solid var(--gridline)" }}>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {item.quantity > 1 ? `${item.quantity}x ` : ""}
        {item.product}
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
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            {total !== null ? formatBRL(total) : "definir valor"}
          </button>
        )}
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
        ) : (
          <button onClick={() => setEditingAuth(true)} className="underline" style={{ color: "var(--text-secondary)" }}>
            {item.paymentAuthorizedBy ?? "definir"}
          </button>
        )}
      </div>
      {error ? (
        <p className="text-xs w-full" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RequestItemsTable({ items, requestId }: { items: RequestItem[]; requestId: string }) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-1"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Produtos
        </span>
        {total > 0 ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Total: {formatBRL(total)}
          </span>
        ) : null}
      </div>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} requestId={requestId} />
      ))}
    </div>
  );
}
