"use client";

import { useState } from "react";
import { setCaixaPinComoGerente, toggleCaixaAtivoComoGerente } from "@/app/assistencia/loja-equipe-actions";
import { useQuickAction } from "./useQuickAction";
import { PIN_LENGTH } from "@/lib/pinConfig";

// Mesma UI de CaixaPinField.tsx, só que chamando as actions do gerente
// (loja-equipe-actions.ts), que verificam que a loja é dele antes de agir.
export function EquipeCaixaPinField({
  name,
  storeName,
  hasPin,
  ativo,
}: {
  name: string;
  storeName: string;
  hasPin: boolean;
  ativo: boolean;
}) {
  const { pending, run, showToast } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm" style={{ color: ativo ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {name} <span style={{ color: "var(--text-muted)" }}>— {storeName}</span>
          {!ativo ? <span style={{ color: "var(--status-critical)" }}> (inativo)</span> : null}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: hasPin ? "var(--status-good)" : "var(--text-muted)" }}>
            {hasPin ? "PIN definido" : "Sem PIN"}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            {hasPin ? "redefinir" : "definir"}
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => toggleCaixaAtivoComoGerente(name, !ativo), ativo ? "Caixa inativada." : "Caixa reativada.")}
            className="text-xs underline disabled:opacity-60"
            style={{ color: ativo ? "var(--status-critical)" : "var(--status-good)" }}
          >
            {ativo ? "inativar" : "reativar"}
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
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
          placeholder={`${PIN_LENGTH} números`}
          inputMode="numeric"
          className="w-24 rounded border px-2 py-1 text-sm text-center"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <button
          disabled={pending || pin.length !== PIN_LENGTH}
          onClick={() => {
            if (pin.length !== PIN_LENGTH) {
              showToast(`O PIN precisa ter ${PIN_LENGTH} números.`, "error");
              return;
            }
            run(async () => {
              await setCaixaPinComoGerente(name, pin);
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
