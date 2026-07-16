"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/assistencia/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signIn, undefined);

  return (
    <div className="max-w-sm mx-auto p-6 mt-20 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
          Assistência — Lojas Maia
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Solicitações de montagem, desmontagem e recolhimento.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
          E-mail
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded border px-3 py-2"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
          Senha
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border px-3 py-2"
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
    </div>
  );
}
