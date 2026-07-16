"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createAssistenciaUser, type FormState } from "@/app/assistencia/admin-actions";

const inputStyle = { borderColor: "var(--border)" };

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createAssistenciaUser, undefined);

  if (state?.success) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Conta criada com sucesso!
        </p>
        <Link href="/assistencia/admin" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          Criar outra conta
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      <input
        name="full_name"
        placeholder="Nome completo"
        required
        className="rounded border px-3 py-2 text-sm"
        style={inputStyle}
      />
      <input
        name="email"
        type="email"
        placeholder="E-mail"
        required
        className="rounded border px-3 py-2 text-sm"
        style={inputStyle}
      />
      <input
        name="password"
        type="password"
        placeholder="Senha (mín. 6 caracteres)"
        required
        className="rounded border px-3 py-2 text-sm"
        style={inputStyle}
      />
      <select name="role" defaultValue="assistencia" className="rounded border px-3 py-2 text-sm" style={inputStyle}>
        <option value="assistencia">Assistência</option>
        <option value="admin">Admin</option>
      </select>
      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded px-4 py-2 font-medium self-start disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Criando…" : "Criar conta"}
      </button>
    </form>
  );
}
