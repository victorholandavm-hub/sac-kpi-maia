"use client";

import { useActionState } from "react";
import { redefinirSenha, type RedefinirSenhaFormState } from "@/app/assistencia/redefinir-senha/actions";

export function RedefinirSenhaForm({ tokenHash }: { tokenHash: string }) {
  const [state, formAction, pending] = useActionState<RedefinirSenhaFormState, FormData>(redefinirSenha, undefined);

  return (
    <form
      action={formAction}
      className="rounded-xl border p-6 flex flex-col gap-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-green)" }}
    >
      <input type="hidden" name="token_hash" value={tokenHash} />
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Nova senha
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
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
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
