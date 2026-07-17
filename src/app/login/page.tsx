"use client";

import { useActionState } from "react";
import { signInDashboard, type FormState } from "./actions";

export default function DashboardLoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signInDashboard, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-orange)" }}>
              Painel de KPIs — SAC Maia
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Acesso restrito à equipe do SAC.
            </p>
          </div>
        </div>

        <form
          action={formAction}
          className="rounded-xl border p-6 flex flex-col gap-4"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
        >
          <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
            Usuário
            <input
              name="user"
              type="text"
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
            style={{ background: "var(--brand-orange)", color: "var(--brand-green-ink)" }}
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
