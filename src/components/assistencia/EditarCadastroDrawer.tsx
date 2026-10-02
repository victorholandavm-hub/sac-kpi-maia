"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateCadastroHistoricoAction, type FormState } from "@/app/assistencia/cadastros-actions";
import type { Cadastro } from "@/lib/cadastrosHistorico";
import { CadastroFormFields } from "./cadastroFormShared";

// Gaveta de edição -- pedido do Victor 02/10/2026 ("preciso que haja um
// botão de editar nos cadastros que foram importados e nos próximos que
// foram cadastrados"), ou seja, vale tanto pras ~3.244 linhas da planilha
// original quanto pros cadastros lançados daqui pra frente (mesma tabela,
// ver NovoCadastroDrawer.tsx). Mesmo desenho/campos do cadastro novo (ver
// cadastroFormShared.tsx), só que pré-preenchido e com Situação editável
// (só edição deixa corrigir pra Concluído/Não concluído -- criar sempre
// nasce Programado).
export function EditarCadastroDrawer({ cadastro }: { cadastro: Cadastro }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateCadastroHistoricoAction, undefined);
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        ✏️ Editar
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar edição"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg flex flex-col shadow-lg"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Editar cadastro
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {cadastro.cliente ?? "Sem nome de cliente"}
                  {cadastro.origemPlanilha !== "Sistema" ? ` · importado (${cadastro.origemPlanilha})` : ""}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
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
              <input type="hidden" name="id" value={cadastro.id} />
              <CadastroFormFields
                isEdit
                defaults={{
                  tipo: cadastro.tipo,
                  codigo: cadastro.codigo ?? "",
                  produto: cadastro.produto ?? "",
                  descricao: cadastro.descricao ?? "",
                  nf: cadastro.nf ?? "",
                  vendedora: cadastro.vendedora ?? "",
                  loja: cadastro.loja ?? "",
                  cnpj: cadastro.cnpj ?? "",
                  cliente: cadastro.cliente ?? "",
                  codigoCliente: cadastro.codigoCliente ?? "",
                  cpf: cadastro.cpf ?? "",
                  telefone: cadastro.telefone ?? "",
                  endereco: cadastro.endereco ?? "",
                  data: cadastro.dataAbertura ?? "",
                  prazo: cadastro.prazoCalculado ? "" : cadastro.prazoData ?? "",
                  prazoNota: cadastro.prazoNota ?? "",
                  solicitante: cadastro.solicitante ?? "",
                  quemMontou: cadastro.quemMontou ?? "",
                  obs: cadastro.obs ?? "",
                  status: cadastro.status,
                }}
              />

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
                {pending ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
