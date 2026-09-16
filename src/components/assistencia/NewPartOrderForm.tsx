"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createPartOrder, type PartOrderFormState } from "@/app/assistencia/pecas-actions";
import type { SupplierContact } from "@/lib/partOrders";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function NewPartOrderForm({
  suppliers,
  supplierContacts,
  defaultValues,
  basePath = "/assistencia/pecas",
}: {
  suppliers: string[];
  // Contato do representante por fornecedor -- pedido do Victor 09/09/2026:
  // "quando... selecionar o fornecedor, já deve puxar automaticamente o
  // nome, contato e e-mail do representante". Preenche os 3 campos abaixo
  // sozinho ao trocar o select; quem digitar por cima continua podendo
  // (campos ficam controlados, não travados).
  supplierContacts: Record<string, SupplierContact>;
  defaultValues?: {
    serviceRequestId?: string;
    clientName?: string;
    clientCpf?: string;
    clientPhone?: string;
    product?: string;
  };
  // Rota própria da equipe técnica desde 14/09/2026 -- ver
  // TecnicoPecasFrame.tsx/pecas-actions.ts.
  basePath?: string;
}) {
  const [state, formAction, pending] = useActionState<PartOrderFormState, FormData>(createPartOrder, undefined);
  const [supplier, setSupplier] = useState("");
  const [representative, setRepresentative] = useState("");
  const [representativeEmail, setRepresentativeEmail] = useState("");
  const [representativePhone, setRepresentativePhone] = useState("");
  // Mais de uma peça na mesma solicitação -- pedido do Victor 16/09/2026:
  // "quando solicitamos mais de uma peça junta, a fábrica manda tudo
  // junto". Só a LISTA DE LINHAS é estado React (pra adicionar/remover
  // funcionar); os 3 campos de cada linha continuam não-controlados
  // (defaultValue), sem onChange a cada tecla. Todas usam o MESMO name
  // (part_name/part_code/color) -- o server action lê tudo de uma vez via
  // FormData.getAll, index a index (ver readParts, pecas-actions.ts).
  const [partRowKeys, setPartRowKeys] = useState<number[]>([0]);
  const nextPartKeyRef = useRef(1);

  function addPartRow() {
    setPartRowKeys((prev) => [...prev, nextPartKeyRef.current++]);
  }
  function removePartRow(key: number) {
    setPartRowKeys((prev) => (prev.length > 1 ? prev.filter((k) => k !== key) : prev));
  }

  function handleSupplierChange(value: string) {
    setSupplier(value);
    const contact = supplierContacts[value];
    setRepresentative(contact?.representative ?? "");
    setRepresentativeEmail(contact?.representativeEmail ?? "");
    setRepresentativePhone(contact?.representativePhone ?? "");
  }

  if (state?.success) {
    return (
      <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Pedido de peça criado!
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Pedido do Victor 15/09/2026: "preciso que tenha um botão de
              fazer uma nova solicitação de peça assim que eu faço um
              solicitação" -- quem tem várias peças pra pedir seguidas não
              precisa voltar pra lista só pra clicar em "Novo" de novo. */}
          <Link
            href={`${basePath}/nova`}
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm transition-all duration-200 hover:brightness-110"
            style={{ background: "var(--brand-green)" }}
          >
            + Novo pedido de peça
          </Link>
          <Link href={basePath} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Voltar para a lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {defaultValues?.serviceRequestId ? (
        <input type="hidden" name="service_request_id" value={defaultValues.serviceRequestId} />
      ) : null}

      <div className="flex flex-col gap-2">
        {partRowKeys.map((key, i) => (
          <div
            key={key}
            className="rounded-lg border p-3 flex flex-col gap-3 relative"
            style={{ borderColor: "var(--border)", background: partRowKeys.length > 1 ? "var(--surface-1)" : undefined }}
          >
            {partRowKeys.length > 1 ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Peça {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removePartRow(key)}
                  className="text-xs underline"
                  style={{ color: "var(--status-critical)" }}
                >
                  Remover
                </button>
              </div>
            ) : null}
            <Field label="Peça *">
              <input name="part_name" required={i === 0} defaultValue="" className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Código da peça">
                <input name="part_code" className="rounded border px-3 py-2" style={inputStyle} />
              </Field>
              <Field label="Cor">
                <input name="color" className="rounded border px-3 py-2" style={inputStyle} />
              </Field>
            </div>
          </div>
        ))}
        {/* Mais de uma peça na mesma solicitação -- pedido do Victor
            16/09/2026: "quando solicitamos mais de uma peça junta, a
            fábrica manda tudo junto". Fornecedor/cliente/nota fiscal etc.
            (resto do formulário) continuam compartilhados por todas as
            peças dessa solicitação -- só peça/código/cor variam linha a
            linha. */}
        <button
          type="button"
          onClick={addPartRow}
          className="text-sm font-medium self-start underline"
          style={{ color: "var(--brand-green)" }}
        >
          + Adicionar outra peça
        </button>
      </div>

      <Field label="Fornecedor">
        <select
          name="supplier"
          value={supplier}
          onChange={(e) => handleSupplierChange(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          <option value="">Selecione…</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="__outro__">Outro…</option>
        </select>
      </Field>
      {supplier === "__outro__" ? (
        <Field label="Nome do fornecedor">
          <input name="supplier_other" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      ) : null}

      <Field label="Representante do fornecedor">
        <input
          name="representative"
          value={representative}
          onChange={(e) => setRepresentative(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
      </Field>

      {/* Contato do REPRESENTANTE (fornecedor) -- distinto do e-mail/telefone
          do cliente lá embaixo (pedido do Victor 09/09/2026, planilha
          "Solicitação de peças"). Preenchidos sozinhos ao escolher o
          fornecedor (ver handleSupplierChange acima) -- continua editável
          por cima, pra representante novo/trocado. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="E-mail do representante">
          <input
            name="representative_email"
            type="email"
            value={representativeEmail}
            onChange={(e) => setRepresentativeEmail(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Telefone do representante">
          <input
            name="representative_phone"
            value={representativePhone}
            onChange={(e) => setRepresentativePhone(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Produto do cliente">
          <input
            name="product"
            defaultValue={defaultValues?.product}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Nome do cliente">
          <input
            name="client_name"
            defaultValue={defaultValues?.clientName}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CPF do cliente">
          <input
            name="client_cpf"
            defaultValue={defaultValues?.clientCpf}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Telefone">
          <input
            name="client_phone"
            defaultValue={defaultValues?.clientPhone}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="E-mail de contato">
        {/* Fixo com o e-mail da assistência por padrão -- pedido urgente
            do Victor 14/09/2026 (o campo vinha em branco toda vez, sem
            fallback nenhum). Continua editável por cima, se precisar
            trocar pelo e-mail de verdade do cliente. */}
        <input name="client_email" type="email" defaultValue="assistencia@moveisaiam.com.br" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Número da nota fiscal">
        {/* Pedido do Victor 15/09/2026: "no chamado para uma nova peça...
            no corpo do texto coloque o numero da nota fiscal" -- vai no
            e-mail pro representante do fornecedor (ver
            PartOrderEmailButton.tsx). */}
        <input name="invoice_number" className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

      <Field label="Observações">
        <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

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
        {pending ? "Criando…" : partRowKeys.length > 1 ? `Criar pedido com ${partRowKeys.length} peças` : "Criar pedido de peça"}
      </button>
    </form>
  );
}
