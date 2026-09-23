"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createEstornoRequestAction,
  lookupTotvsClientForEstorno,
  lookupTotvsProductForEstorno,
  type EstornoFormState,
} from "@/app/assistencia/estornos-actions";
import { MoneyInput, MoneyFieldRaw } from "./MoneyInput";

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

const PARCELAS = ["À vista", ...Array.from({ length: 11 }, (_, i) => `${i + 2}x`)];

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
  const [clienteLookupStatus, setClienteLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!codigoCliente.trim()) {
        setClienteLookupStatus("idle");
        return;
      }
      setClienteLookupStatus("loading");
      lookupTotvsClientForEstorno(codigoCliente)
        .then((match) => {
          if (!match) {
            setClienteLookupStatus("not_found");
            return;
          }
          setClienteNome(match.name);
          setCpf(match.cpfCnpj ?? "");
          setClienteLookupStatus("found");
        })
        .catch(() => setClienteLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [codigoCliente]);

  // Mesma ideia pro produto -- pedido do Victor 23/09/2026.
  const [codigoProduto, setCodigoProduto] = useState("");
  const [produto, setProduto] = useState("");
  const [produtoLookupStatus, setProdutoLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!codigoProduto.trim()) {
        setProdutoLookupStatus("idle");
        return;
      }
      setProdutoLookupStatus("loading");
      lookupTotvsProductForEstorno(codigoProduto)
        .then((match) => {
          if (!match) {
            setProdutoLookupStatus("not_found");
            return;
          }
          setProduto(match.description ?? codigoProduto);
          setProdutoLookupStatus("found");
        })
        .catch(() => setProdutoLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [codigoProduto]);

  // Pix ou Cartão (com parcelas) -- pedido do Victor 23/09/2026: antes era
  // texto livre. Pode ter MAIS de uma forma na mesma venda (pedido do
  // Victor, revisão do mesmo dia: "as vezes o cliente paga um pedaço no
  // valor no pix e outro pedaço no cartão") -- lista de linhas, cada uma
  // com método + parcelas (se cartão) + valor daquela parte. Combina tudo
  // num único texto pro campo forma_pagamento (mesma coluna de sempre) via
  // hidden input.
  const pagamentoIdSeq = useRef(1);
  const [pagamentos, setPagamentos] = useState(() => [{ id: 0, metodo: "pix" as "pix" | "cartao", parcelas: PARCELAS[0], cents: 0 }]);

  function addPagamento() {
    setPagamentos((prev) => [...prev, { id: pagamentoIdSeq.current++, metodo: "pix", parcelas: PARCELAS[0], cents: 0 }]);
  }
  function removePagamento(id: number) {
    setPagamentos((prev) => prev.filter((p) => p.id !== id));
  }
  function updatePagamento(id: number, patch: Partial<(typeof pagamentos)[number]>) {
    setPagamentos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const formaPagamento = pagamentos
    .filter((p) => p.cents > 0)
    .map((p) => {
      const label = p.metodo === "pix" ? "Pix" : `Cartão - ${p.parcelas}`;
      const valor = (p.cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `${label}: ${valor}`;
    })
    .join(" + ");

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
        {clienteLookupStatus === "loading" ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Buscando…
          </span>
        ) : clienteLookupStatus === "found" ? (
          <span className="text-xs" style={{ color: "var(--status-good)" }}>
            Cliente encontrado: {clienteNome}
          </span>
        ) : clienteLookupStatus === "not_found" ? (
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
        <Field label="Valor do reembolso" required>
          <MoneyInput name="valor_reembolso" required />
        </Field>
        <Field label="Data da venda">
          <input name="data_venda" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          Forma de pagamento
        </span>
        {/* Mais de uma linha quando o cliente pagou parte no Pix e parte no
            cartão -- pedido do Victor 23/09/2026. */}
        {pagamentos.map((p) => (
          <div key={p.id} className="flex items-center gap-2 flex-wrap">
            <select
              value={p.metodo}
              onChange={(e) => updatePagamento(p.id, { metodo: e.target.value as "pix" | "cartao" })}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
            </select>
            {p.metodo === "cartao" ? (
              <select
                value={p.parcelas}
                onChange={(e) => updatePagamento(p.id, { parcelas: e.target.value })}
                className="rounded border px-3 py-2"
                style={inputStyle}
              >
                {PARCELAS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : null}
            <MoneyFieldRaw cents={p.cents} onChange={(cents) => updatePagamento(p.id, { cents })} />
            {pagamentos.length > 1 ? (
              <button
                type="button"
                onClick={() => removePagamento(p.id)}
                className="text-xs underline"
                style={{ color: "var(--status-critical)" }}
              >
                remover
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" onClick={addPagamento} className="text-xs underline self-start" style={{ color: "var(--brand-green)" }}>
          + Adicionar forma de pagamento
        </button>
        <input type="hidden" name="forma_pagamento" value={formaPagamento} />
      </div>

      <Field label="Código do produto">
        <input
          name="codigo_produto"
          type="text"
          value={codigoProduto}
          onChange={(e) => setCodigoProduto(e.target.value)}
          placeholder="Código do produto na venda"
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
        {produtoLookupStatus === "loading" ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Buscando…
          </span>
        ) : produtoLookupStatus === "found" ? (
          <span className="text-xs" style={{ color: "var(--status-good)" }}>
            Produto encontrado
          </span>
        ) : produtoLookupStatus === "not_found" ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Código não encontrado -- preencha o produto à mão.
          </span>
        ) : null}
      </Field>
      <Field label="Produto">
        <input
          name="produto"
          type="text"
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        />
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
