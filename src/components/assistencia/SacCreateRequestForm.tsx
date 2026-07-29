"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createSacRequest, type FormState } from "@/app/assistencia/actions";
import { SAC_CATEGORIES, SAC_CATEGORY_LABELS, REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import type { Store } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

type SacType = "troca_produto" | "entrega_produto" | "envio_peca" | "notificacao_externa";

// Tipos que envolvem entrega pelo motorista (produto/peça + quem vai levar).
// "O que recolher" só se aplica a troca_produto — os outros dois não têm
// recolhimento nenhum.
const DELIVERY_TYPES: SacType[] = ["troca_produto", "entrega_produto", "envio_peca"];

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
  const [type, setType] = useState<SacType>("troca_produto");
  const isDelivery = DELIVERY_TYPES.includes(type);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Tipo e loja" number={1}>
        <Field label="Tipo">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as SacType)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="troca_produto">{REQUEST_TYPE_LABELS.troca_produto} (recolher + entregar)</option>
            <option value="entrega_produto">{REQUEST_TYPE_LABELS.entrega_produto} (sem recolhimento)</option>
            <option value="envio_peca">{REQUEST_TYPE_LABELS.envio_peca}</option>
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

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <input type="checkbox" name="urgent" className="rounded" />
          Urgente
        </label>
      </FormSection>

      <FormSection title="Dados do cliente" number={2} hint="Só o nome é obrigatório.">
        <Field label="Nome do cliente *">
          <input name="client_name" required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Telefone *">
            <input name="client_phone" required className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Endereço *">
            <input name="client_address" required className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </div>

        <Field label="Bairro *">
          <input name="client_neighborhood" required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </FormSection>

      {isDelivery ? (
        <FormSection title="Produto e entrega" number={3}>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Produto a entregar">
              <input name="product" placeholder="Ex: Super Box Confort Mola Ensacada" className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
            <Field label="Código do produto">
              <input name="part_code" placeholder="Ex: SB-3050" className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
            <Field label="Quantidade">
              <input name="quantity" type="number" min={1} defaultValue={1} className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
          </div>

          <Field label="Motorista">
            <input name="driver_name" list="sac-drivers" className="rounded border px-3 py-2" style={inputStyle} />
            <datalist id="sac-drivers">
              {drivers.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>
        </FormSection>
      ) : null}

      <FormSection title="Detalhes" number={4} hint="Conte o que aconteceu, com o máximo de detalhe que puder.">
        <Field label="Motivo *">
          <textarea name="reason" rows={2} required placeholder="Ex: produto entregue com avaria" className="rounded border px-3 py-2" style={inputStyle} />
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

        <Field label="Foto (opcional)">
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            className="rounded border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </Field>
      </FormSection>

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
