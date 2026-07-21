"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createSacRequest, type FormState } from "@/app/assistencia/actions";
import { SAC_CATEGORIES, SAC_CATEGORY_LABELS } from "@/lib/assistenciaLabels";
import type { Store } from "@/lib/serviceRequests";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function SacCreateRequestForm({ stores, drivers }: { stores: Store[]; drivers: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSacRequest, undefined);
  const [type, setType] = useState<"troca_produto" | "notificacao_externa">("troca_produto");

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Tipo">
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          <option value="troca_produto">Troca de produto (recolher + entregar)</option>
          <option value="notificacao_externa">Notificação externa (sem troca de produto)</option>
        </select>
      </Field>

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

      {type === "notificacao_externa" ? (
        <Field label="Categoria *">
          <select name="sac_category" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
            <option value="" disabled>
              Selecione…
            </option>
            {SAC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SAC_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
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

      <Field label="Bairro">
        <input name="client_neighborhood" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {type === "troca_produto" ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Produto a entregar">
            <input name="product" placeholder="Ex: Super Box Confort Mola Ensacada" className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" min={1} defaultValue={1} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </div>
      ) : null}

      <Field label="Motivo">
        <textarea name="reason" rows={2} placeholder="Ex: produto entregue com avaria" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      {type === "troca_produto" ? (
        <Field label="O que recolher / instrução pro motorista">
          <textarea
            name="restriction_note"
            rows={2}
            placeholder="Ex: recolher Super Box avariada e entregar a nova"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      ) : null}

      {type === "troca_produto" ? (
        <Field label="Motorista">
          <input name="driver_name" list="sac-drivers" className="rounded border px-3 py-2" style={inputStyle} />
          <datalist id="sac-drivers">
            {drivers.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
      ) : null}

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
        {pending ? "Criando…" : "Criar solicitação"}
      </button>
    </form>
  );
}
