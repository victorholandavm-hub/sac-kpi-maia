"use client";

import { useState } from "react";
import { setGerentePin } from "@/app/assistencia/admin-actions";
import { useQuickAction } from "./useQuickAction";

export function GerentePinField({ name, storeName, hasPin }: { name: string; storeName: string; hasPin: boolean }) {
  const { pending, run, showToast } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {name} <span style={{ color: "var(--text-muted)" }}>— {storeName}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: hasPin ? "var(--status-good)" : "var(--text-muted)" }}>
            {hasPin ? "PIN definido" : "Sem PIN"}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            {hasPin ? "redefinir" : "definir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {name}
      </span>
      <div className="flex items-center gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4 números"
          inputMode="numeric"
          className="w-20 rounded border px-2 py-1 text-sm text-center"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <button
          disabled={pending || pin.length !== 4}
          onClick={() => {
            if (pin.length !== 4) {
              showToast("O PIN precisa ter 4 números.", "error");
              return;
            }
            run(async () => {
              await setGerentePin(name, pin);
              setEditing(false);
              setPin("");
            }, `PIN de ${name} definido.`);
          }}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setPin("");
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
