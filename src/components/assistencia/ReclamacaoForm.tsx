"use client";

import { useActionState } from "react";
import { createReclamacaoAction, updateReclamacaoAction, type ReclamacaoFormState } from "@/app/assistencia/reclamacoes-actions";
import { ORGAO_OPTIONS, STATUS_INTERNO_OPTIONS } from "@/lib/reclamacoesLabels";
import type { Reclamacao } from "@/lib/reclamacoes";

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

// timestamptz (UTC no banco) -> valor de <input type="datetime-local"> em
// horário de Brasília -- offset fixo -03 (sem horário de verão desde
// 2019, mesma premissa do parse original da planilha). Espelha
// parseAudiencia em reclamacoes-actions.ts (que faz o caminho inverso).
function toDatetimeLocalValue(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

// Formulário de cadastro/edição -- mesmo par (nasce, editar depois) de
// NewPartOrderForm.tsx/EditPartOrderForm.tsx. Um componente só (em vez de
// um por modo) porque os campos são idênticos, só muda a action e os
// valores iniciais.
export function ReclamacaoForm({ reclamacao }: { reclamacao?: Reclamacao }) {
  const action = reclamacao ? updateReclamacaoAction.bind(null, reclamacao.id) : createReclamacaoAction;
  const [state, formAction, pending] = useActionState<ReclamacaoFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome" required>
          <input name="nome" type="text" required defaultValue={reclamacao?.nome} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="CPF">
          <input name="cpf" type="text" defaultValue={reclamacao?.cpf ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="Órgão" required>
        <input
          name="orgao"
          type="text"
          required
          list="reclamacao-orgaos"
          defaultValue={reclamacao?.orgao}
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
        <datalist id="reclamacao-orgaos">
          {ORGAO_OPTIONS.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>

      <Field label="Data de recebimento">
        <input
          name="data_recebimento"
          type="date"
          defaultValue={reclamacao?.dataRecebimento ?? ""}
          className="rounded border px-3 py-2 max-w-[200px]"
          style={inputStyle}
        />
      </Field>

      <Field label="Status (interno)" required>
        <input
          name="status_interno"
          type="text"
          required
          list="reclamacao-status"
          defaultValue={reclamacao?.statusInterno ?? "Falta responder"}
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
        <datalist id="reclamacao-status">
          {STATUS_INTERNO_OPTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <Field label="Status externo (no órgão)">
        <input
          name="status_externo"
          type="text"
          defaultValue={reclamacao?.statusExterno ?? ""}
          placeholder="Ex.: Audiência designada, Respondido…"
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
      </Field>

      <Field label="Data e hora da audiência">
        <input
          name="data_audiencia"
          type="datetime-local"
          defaultValue={reclamacao?.dataAudiencia ? toDatetimeLocalValue(reclamacao.dataAudiencia) : ""}
          className="rounded border px-3 py-2 max-w-[240px]"
          style={inputStyle}
        />
      </Field>

      <Field label="Documentos">
        <input
          name="documentos"
          type="text"
          defaultValue={reclamacao?.documentos ?? ""}
          placeholder="Nota sobre documentos anexados"
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
      </Field>

      <Field label="Recebido por">
        <input name="recebido_por" type="text" defaultValue={reclamacao?.recebidoPor ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Observações">
        <textarea name="observacoes" rows={3} defaultValue={reclamacao?.observacoes ?? ""} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start text-sm px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-60"
        style={{ background: "#1B5E3C" }}
      >
        {pending ? "Salvando…" : reclamacao ? "Salvar alterações" : "Cadastrar reclamação"}
      </button>
    </form>
  );
}
