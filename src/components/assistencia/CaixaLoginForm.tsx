"use client";

import { useActionState } from "react";
import { caixaSignIn, type CaixaFormState } from "@/app/assistencia/caixa-actions";
import type { Store } from "@/lib/serviceRequests";

// PIN é por loja, não por pessoa (ver 0028_encomenda_pin_auth.sql) — por isso
// a caixa escolhe a loja num select em vez de digitar o próprio nome.
export function CaixaLoginForm({ stores }: { stores: Store[] }) {
  const [state, formAction, pending] = useActionState<CaixaFormState, FormData>(caixaSignIn, undefined);

  return (
    <form
      action={formAction}
      className="rounded-xl border p-6 flex flex-col gap-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
    >
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Sua loja
        <select name="store_id" required defaultValue="" className="rounded border px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <option value="" disabled>
            Selecione…
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        PIN da loja (4 números)
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          required
          autoComplete="off"
          className="rounded border px-3 py-2 text-center text-2xl tracking-[0.5em]"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded px-3 py-2 font-medium disabled:opacity-60"
        style={{ background: "var(--brand-orange)", color: "#fff" }}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
