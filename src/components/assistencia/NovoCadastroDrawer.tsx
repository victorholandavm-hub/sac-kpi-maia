"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addCadastroHistoricoAction, type FormState } from "@/app/assistencia/cadastros-actions";
import { CadastroFormFields } from "./cadastroFormShared";

// Gaveta lateral (não modal central) pra lançar um cadastro novo direto
// pelo sistema -- pedido do Victor 01/10/2026, mesmo desenho do protótipo
// aprovado em Artifact (17 campos em 4 seções, ficaria apertado demais
// num modal central). addCadastroHistoricoAction só revalida a página
// (sem redirect) -- fecha a gaveta sozinho só depois de uma submissão
// real sem erro (ref evita fechar no primeiro render, antes de qualquer
// clique em "Salvar"). Os campos em si moram em cadastroFormShared.tsx,
// compartilhados com EditarCadastroDrawer.tsx -- fechar a gaveta desmonta
// o form inteiro, então reabrir já volta com os campos zerados de graça.
export function NovoCadastroDrawer() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(addCadastroHistoricoAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!pending && submittedRef.current && !state?.error) {
      submittedRef.current = false;
      setOpen(false);
    }
  }, [pending, state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110"
        style={{ background: "var(--brand-orange)" }}
      >
        + Adicionar novo cadastro
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg flex flex-col shadow-lg"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Novo cadastro
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Controle de montagens e assistências técnicas
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-sm px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>

            <form
              ref={formRef}
              action={(fd) => {
                submittedRef.current = true;
                formAction(fd);
              }}
              className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4"
            >
              <CadastroFormFields />

              {state?.error ? (
                <p className="text-sm" style={{ color: "var(--status-critical)" }}>
                  {state.error}
                </p>
              ) : null}
            </form>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm px-4 py-2.5 rounded-lg font-medium border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                disabled={pending}
                className="text-sm px-4 py-2.5 rounded-lg font-semibold disabled:opacity-60"
                style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
              >
                {pending ? "Salvando…" : "Salvar cadastro"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
