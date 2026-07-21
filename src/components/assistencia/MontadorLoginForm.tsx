"use client";

import { useActionState } from "react";
import { montadorSignIn, type MontadorFormState } from "@/app/assistencia/montador-actions";

export function MontadorLoginForm() {
  const [state, formAction, pending] = useActionState<MontadorFormState, FormData>(montadorSignIn, undefined);

  return (
    <form
      action={formAction}
      className="rounded-xl border p-6 flex flex-col gap-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-green)" }}
    >
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Seu nome
        <input
          name="name"
          type="text"
          required
          autoComplete="off"
          className="rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        PIN (4 números)
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
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
