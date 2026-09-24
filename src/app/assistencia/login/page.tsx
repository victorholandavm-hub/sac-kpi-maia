"use client";

import { useActionState, useState } from "react";
import { signIn, type FormState } from "@/app/assistencia/actions";
import { LoginFormShell, loginInputClassName, loginInputStyle } from "@/components/assistencia/LoginFormShell";

// "Lembrar meu e-mail" -- conveniência por navegador (localStorage), nunca
// a senha. Tentativa de leitura/escrita embrulhada em try/catch: janela
// anônima ou site data bloqueado pode lançar, e isso não pode quebrar o
// login em si.
const REMEMBER_EMAIL_KEY = "assistencia-login-email";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signIn, undefined);
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [remember, setRemember] = useState(true);

  function handleSubmit() {
    try {
      if (remember && email) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
    } catch {
      // não crítico -- login continua normalmente.
    }
  }

  return (
    <LoginFormShell roleTitle="Equipe / Admin" roleSubtitle="Entre com seu e-mail e senha.">
      <form
        action={formAction}
        onSubmit={handleSubmit}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={loginInputClassName}
            style={loginInputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
          Senha
          <input name="password" type="password" required autoComplete="current-password" className={loginInputClassName} style={loginInputStyle} />
        </label>

        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded"
            style={{ accentColor: "var(--brand-green)" }}
          />
          Lembrar meu e-mail
        </label>

        {state?.error ? (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg px-3 py-2.5 font-semibold text-white disabled:opacity-60 transition-colors"
          style={{ background: "#1B5E3C" }}
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </LoginFormShell>
  );
}
