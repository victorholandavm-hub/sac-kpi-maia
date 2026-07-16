"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "@/app/assistencia/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signIn, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Equipe assistência
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Solicitações de montagem, desmontagem e recolhimento.
            </p>
          </div>
        </div>

        <form
          action={formAction}
          className="rounded-xl border p-6 flex flex-col gap-4"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-green)" }}
        >
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

        <Link href="/assistencia" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
