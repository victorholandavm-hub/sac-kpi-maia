"use client";

import { useActionState, useState } from "react";
import { createQuickRequest, type FormState } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS, MANOEL_ONLY_TYPES, MANOEL_ONLY_ASSEMBLER } from "@/lib/assistenciaLabels";
import { SHIFTS, type Store } from "@/lib/serviceRequests";

const ASSISTENCIA_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria"] as const;
const SAC_TYPE = "notificacao_externa" as const;

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function QuickCreateRequestForm({
  stores,
  assemblers,
  includeSacTypes,
}: {
  stores: Store[];
  assemblers: string[];
  includeSacTypes: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createQuickRequest, undefined);
  const TYPES = includeSacTypes ? [...ASSISTENCIA_TYPES, SAC_TYPE] : ASSISTENCIA_TYPES;
  const [type, setType] = useState<string>("vistoria");
  const isManoelOnly = (MANOEL_ONLY_TYPES as readonly string[]).includes(type);
  const showCombo = type === "montagem" || type === "desmontagem";

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Loja *">
          <select name="store_id" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
            <option value="" disabled>
              Selecione…
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {showCombo ? (
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <input type="checkbox" name="combo_montagem_desmontagem" className="rounded" />
          {type === "montagem" ? "Também precisa desmontar o móvel antigo" : "Também precisa montar o móvel novo"}
        </label>
      ) : null}

      <Field label="Nome do cliente *">
        <input name="client_name" required className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Telefone">
          <input name="client_phone" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Endereço">
          <input name="client_address" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <Field label="O que precisa ser feito">
        <textarea name="reason" rows={2} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <div className="grid sm:grid-cols-4 gap-4">
        <Field label="Data agendada">
          <input name="scheduled_date" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Hora">
          <input name="scheduled_time" type="time" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Turno">
          <select name="shift" defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
            <option value="">Sem turno</option>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {SHIFT_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Técnico/montador">
          {isManoelOnly ? (
            <input
              name="assembler_name"
              value={MANOEL_ONLY_ASSEMBLER}
              readOnly
              className="rounded border px-3 py-2"
              style={{ ...inputStyle, background: "var(--surface-1)", color: "var(--text-secondary)" }}
            />
          ) : (
            <>
              <input name="assembler_name" list="quick-assemblers" className="rounded border px-3 py-2" style={inputStyle} />
              <datalist id="quick-assemblers">
                {assemblers.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Produto/serviço (pagamento)">
          <input name="product" placeholder="Ex: Trocar porta" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Quantidade">
          <input name="quantity" type="number" min={1} defaultValue={1} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Valor (R$)">
          <input name="unit_value" type="number" min={0} step="0.01" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

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
        {pending ? "Criando…" : "Criar"}
      </button>
    </form>
  );
}
