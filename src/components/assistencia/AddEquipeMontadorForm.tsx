"use client";

import { useActionState, useState } from "react";
import { addAssemblerComoGerente, type FormState } from "@/app/assistencia/loja-equipe-actions";
import { PIN_LENGTH } from "@/lib/pinConfig";

export function AddEquipeMontadorForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addAssemblerComoGerente, undefined);
  const [pin, setPin] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          name="name"
          placeholder="Nome do montador"
          required
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        {stores.length > 1 ? (
          <select name="store_id" required defaultValue="" className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--border)" }}>
            <option value="" disabled>
              Loja…
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="store_id" value={stores[0]?.id ?? ""} />
        )}
        <input
          name="pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
          placeholder={`PIN (${PIN_LENGTH} números)`}
          inputMode="numeric"
          required
          className="w-32 rounded border px-2 py-1 text-sm text-center"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Adicionando…" : "Adicionar"}
        </button>
        {state?.error ? (
          <span className="text-xs" style={{ color: "var(--status-critical)" }}>
            {state.error}
          </span>
        ) : null}
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Defina o PIN aqui e repasse pro montador — ele entra com nome + esse PIN em{" "}
        <span className="font-mono">/assistencia/montador/login</span>.
      </p>
    </form>
  );
}
