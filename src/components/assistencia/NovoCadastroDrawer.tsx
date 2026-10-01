"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addCadastroHistoricoAction, type FormState } from "@/app/assistencia/cadastros-actions";
import { CADASTRO_TIPOS, CADASTRO_TIPO_LABELS } from "@/lib/cadastrosHistorico";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {required ? <span style={{ color: "var(--status-critical)" }}> *</span> : null}
      {children}
    </label>
  );
}

// Mesma máscara do protótipo aprovado (Artifact, 01/10/2026) -- aplicada
// no onChange, nunca trava digitação (sempre aceita o que a pessoa
// digitou, só reformata).
function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// Gaveta lateral (não modal central) pra lançar um cadastro novo direto
// pelo sistema -- pedido do Victor 01/10/2026, mesmo desenho do protótipo
// aprovado em Artifact (17 campos em 4 seções, ficaria apertado demais
// num modal central). addCadastroHistoricoAction só revalida a página
// (sem redirect) -- fecha a gaveta sozinho só depois de uma submissão
// real sem erro (ref evita fechar no primeiro render, antes de qualquer
// clique em "Salvar").
export function NovoCadastroDrawer() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(addCadastroHistoricoAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    if (!pending && submittedRef.current && !state?.error) {
      submittedRef.current = false;
      setOpen(false);
      formRef.current?.reset();
      setCpf("");
      setCnpj("");
      setTelefone("");
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
              <FormSection title="Informações do produto" number={1}>
                <Field label="Solicitação" required>
                  <select name="tipo" required defaultValue="ASSISTENCIA" className="rounded border px-3 py-2" style={inputStyle}>
                    {CADASTRO_TIPOS.filter((t) => t !== "HISTORICO").map((t) => (
                      <option key={t} value={t}>
                        {CADASTRO_TIPO_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Código produto">
                  <input name="codigo" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="Produto" required>
                  <input name="produto" required className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="Descrição">
                  <textarea name="descricao" rows={2} placeholder="O que aconteceu, especificamente" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
              </FormSection>

              <FormSection title="Detalhes da venda" number={2}>
                <Field label="NF (nota fiscal)">
                  <input name="nf" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="Vendedor(a)">
                  <input name="vendedora" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="Loja">
                  <input name="loja" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="CNPJ">
                  <input
                    name="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    className="rounded border px-3 py-2"
                    style={inputStyle}
                  />
                </Field>
              </FormSection>

              <FormSection title="Dados do cliente" number={3}>
                <Field label="Cliente" required>
                  <input name="cliente" required className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="CPF">
                  <input
                    name="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    className="rounded border px-3 py-2"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    name="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    className="rounded border px-3 py-2"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Endereço">
                  <input name="endereco" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
              </FormSection>

              <FormSection title="Logística de montagem" number={4}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Data">
                    <input name="data" type="date" className="rounded border px-3 py-2" style={inputStyle} />
                  </Field>
                  <Field label="Prazo">
                    <input name="prazo" type="date" className="rounded border px-3 py-2" style={inputStyle} />
                  </Field>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Prazo em branco vira 30 dias a partir da Data automaticamente.
                </p>
                <Field label="Solicitante / Montador">
                  <input name="solicitante" placeholder="Em branco = você mesmo" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="Quem montou">
                  <input name="quemMontou" placeholder="Preenchido depois da visita" className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
                <Field label="OBS">
                  <textarea name="obs" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
                </Field>
              </FormSection>

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
