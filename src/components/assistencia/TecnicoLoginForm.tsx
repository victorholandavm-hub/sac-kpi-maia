"use client";

import { useActionState } from "react";
import { tecnicoSignIn, type TecnicoFormState } from "@/app/assistencia/tecnico-actions";
import { PIN_LENGTH } from "@/lib/pinConfig";
import { usePinAutoSubmit } from "./usePinAutoSubmit";
import { loginInputClassName, loginInputStyle } from "./LoginFormShell";

export function TecnicoLoginForm() {
  const [state, formAction, pending] = useActionState<TecnicoFormState, FormData>(tecnicoSignIn, undefined);
  const { formRef, onPinChange } = usePinAutoSubmit(pending);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border p-6 flex flex-col gap-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-green)" }}
    >
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Seu nome
        <input name="name" type="text" required autoComplete="off" className={loginInputClassName} style={loginInputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        PIN
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          pattern={`\\d{4,${PIN_LENGTH}}`}
          maxLength={PIN_LENGTH}
          required
          autoComplete="off"
          onChange={onPinChange}
          className={`${loginInputClassName} text-center text-2xl tracking-[0.5em]`}
          style={loginInputStyle}
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
        className="rounded-lg px-3 py-2.5 font-semibold text-white disabled:opacity-60 transition-colors"
        style={{ background: "#1B5E3C" }}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
