"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEstornoAction } from "@/app/clientes/actions";

// Formulário de registro de novo estorno -- pedido do Victor 22/09/2026:
// aba "Estornos" em /clientes, mesmo espírito de GoogleReviewRow
// (GoogleReviewsSection.tsx) -- inputs controlados num único objeto de
// estado (não 12 useState separados, mas também não FormData/form action,
// pra ficar no mesmo padrão do resto do projeto) + onClick no botão
// "Salvar", sem <form onSubmit>. Recolhido por padrão (botão "+ Registrar
// novo estorno") -- 8 campos de uma vez só, sempre visível, poluiria o
// topo da aba pra quem só quer CONSULTAR o histórico (o caso mais comum).
const HOJE = () => new Date().toISOString().slice(0, 10);

type FormState = {
  dataSolicitacao: string;
  cliente: string;
  cpfCnpj: string;
  codigoCliente: string;
  valorReembolso: string;
  dataVenda: string;
  formaPagamento: string;
  loja: string;
  autorizadoPor: string;
  produto: string;
  motivo: string;
  status: string;
};

function emptyForm(): FormState {
  return {
    dataSolicitacao: HOJE(),
    cliente: "",
    cpfCnpj: "",
    codigoCliente: "",
    valorReembolso: "",
    dataVenda: "",
    formaPagamento: "",
    loja: "",
    autorizadoPor: "",
    produto: "",
    motivo: "",
    status: "",
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
      {label}
      {required ? <span style={{ color: "var(--status-critical)" }}> *</span> : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm rounded border px-2.5 py-1.5"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" }}
      />
    </label>
  );
}

export function EstornoFormCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    const valor = parseFloat(form.valorReembolso.replace(",", "."));
    setPending(true);
    setError(null);
    try {
      await createEstornoAction({
        dataSolicitacao: form.dataSolicitacao,
        cliente: form.cliente,
        cpfCnpj: form.cpfCnpj || null,
        codigoCliente: form.codigoCliente || null,
        valorReembolso: valor,
        dataVenda: form.dataVenda || null,
        formaPagamento: form.formaPagamento || null,
        loja: form.loja,
        autorizadoPor: form.autorizadoPor || null,
        produto: form.produto || null,
        motivo: form.motivo || null,
        status: form.status || null,
      });
      setForm(emptyForm());
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar o estorno.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm px-4 py-2 rounded font-medium"
        style={{ background: "var(--brand-orange)", color: "#fff" }}
      >
        + Registrar novo estorno
      </button>
    );
  }

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", borderColor: "var(--brand-orange)" }}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Registrar novo estorno
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancelar
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Data da solicitação" type="date" value={form.dataSolicitacao} onChange={(v) => update("dataSolicitacao", v)} required />
        <Field label="Cliente" value={form.cliente} onChange={(v) => update("cliente", v)} required placeholder="Nome do cliente" />
        <Field label="CPF/CNPJ" value={form.cpfCnpj} onChange={(v) => update("cpfCnpj", v)} />
        <Field label="Código cliente" value={form.codigoCliente} onChange={(v) => update("codigoCliente", v)} placeholder="Protheus ou venda avulsa" />
        <Field label="Valor do reembolso (R$)" value={form.valorReembolso} onChange={(v) => update("valorReembolso", v)} required placeholder="0,00" />
        <Field label="Data da venda" type="date" value={form.dataVenda} onChange={(v) => update("dataVenda", v)} />
        <Field label="Forma de pagamento" value={form.formaPagamento} onChange={(v) => update("formaPagamento", v)} placeholder="Pix, crédito 12x…" />
        <Field label="Loja" value={form.loja} onChange={(v) => update("loja", v)} required placeholder="Ex.: Lojas Maia" />
        <Field label="Autorizado por" value={form.autorizadoPor} onChange={(v) => update("autorizadoPor", v)} />
      </div>
      <Field label="Produto" value={form.produto} onChange={(v) => update("produto", v)} />
      <Field label="Motivo" value={form.motivo} onChange={(v) => update("motivo", v)} placeholder="O que aconteceu" />
      <Field label="Status" value={form.status} onChange={(v) => update("status", v)} placeholder="Ex.: Comprovante enviado, Revertido…" />

      {error ? (
        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="self-start text-sm px-4 py-2 rounded font-medium disabled:opacity-60"
        style={{ background: "var(--brand-orange)", color: "#fff" }}
      >
        {pending ? "Salvando…" : "Salvar estorno"}
      </button>
    </div>
  );
}
