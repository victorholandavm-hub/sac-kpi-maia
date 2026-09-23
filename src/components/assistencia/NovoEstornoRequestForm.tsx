"use client";

import { useActionState, useEffect, useState } from "react";
import { createEstornoRequestAction, lookupTotvsClientForEstorno, type EstornoFormState } from "@/app/assistencia/estornos-actions";

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

// Campos do print de referência do Victor (WhatsApp de estorno, 23/09/2026)
// -- mesmo padrão de formulário de NewPartOrderForm.tsx (FormData + Server
// Action, anexo obrigatório).
export function NovoEstornoRequestForm({ storeOptions }: { storeOptions?: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<EstornoFormState, FormData>(createEstornoRequestAction, undefined);

  // Código do cliente puxa nome + CPF automaticamente -- pedido do Victor
  // 23/09/2026, mesmo padrão de lookupTotvsClientForEncomenda
  // (NovoPedidoEncomendaForm.tsx), só que aqui PREENCHE os campos (esse
  // formulário tem nome/CPF de verdade, não é só uma conferência). Os dois
  // continuam editáveis à mão -- cobre o cliente sem cadastro completo ou
  // um código digitado errado.
  const [codigoCliente, setCodigoCliente] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!codigoCliente.trim()) {
        setLookupStatus("idle");
        return;
      }
      setLookupStatus("loading");
      lookupTotvsClientForEstorno(codigoCliente)
        .then((match) => {
          if (!match) {
            setLookupStatus("not_found");
            return;
          }
          setClienteNome(match.name);
          setCpf(match.cpfCnpj ?? "");
          setLookupStatus("found");
        })
        .catch(() => setLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [codigoCliente]);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {storeOptions && storeOptions.length > 1 ? (
        <Field label="Loja" required>
          <select name="store_id" required className="rounded border px-3 py-2" style={inputStyle} defaultValue="">
            <option value="" disabled>
              Selecione a loja
            </option>
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Código do cliente">
        <input
          name="codigo_cliente"
          type="text"
          value={codigoCliente}
          onChange={(e) => setCodigoCliente(e.target.value)}
          placeholder="Código do cliente na venda"
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
        {lookupStatus === "loading" ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Buscando…
          </span>
        ) : lookupStatus === "found" ? (
          <span className="text-xs" style={{ color: "var(--status-good)" }}>
            Cliente encontrado: {clienteNome}
          </span>
        ) : lookupStatus === "not_found" ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Código não encontrado -- preencha nome e CPF à mão.
          </span>
        ) : null}
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Cliente" required>
          <input
            name="cliente_nome"
            type="text"
            required
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="CPF">
          <input name="cpf" type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="NF de entrada">
          <input name="nf_entrada" type="text" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="NF de devolução">
          <input name="nf_devolucao" type="text" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Valor do reembolso (R$)" required>
          <input name="valor_reembolso" type="text" inputMode="decimal" required placeholder="0,00" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Data da venda">
          <input name="data_venda" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      <Field label="Forma de pagamento">
        <input name="forma_pagamento" type="text" placeholder="Ex.: 6x Master" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <Field label="Produto">
        <input name="produto" type="text" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <Field label="Motivo">
        <textarea name="motivo" rows={2} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>
      <Field label="Autorizado por">
        <input name="autorizado_por" type="text" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Comprovante da venda (foto ou PDF)" required>
        <input name="anexo" type="file" accept="image/*,application/pdf" required className="rounded border px-3 py-2" style={inputStyle} />
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
        {pending ? "Enviando…" : "Enviar solicitação"}
      </button>
    </form>
  );
}
