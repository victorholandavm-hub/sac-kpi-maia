"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createEstornoRequestAction,
  lookupTotvsClientForEstorno,
  lookupTotvsProductForEstorno,
  type EstornoFormState,
} from "@/app/assistencia/estornos-actions";
import { MoneyFieldRaw } from "./MoneyInput";

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

type MetodoPagamento = "credito" | "debito" | "pix" | "dinheiro" | "carne";
const METODO_LABELS: Record<MetodoPagamento, string> = {
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  pix: "Pix",
  dinheiro: "Dinheiro",
  carne: "Carnê",
};

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  // Forma de pagamento com 5 opções (pedido do Victor 23/09/2026, lista
  // exata que ele passou) -- só "Cartão de Crédito" pede parcelas. Pode ter
  // MAIS de uma forma na mesma venda (revisão do mesmo dia: "as vezes o
  // cliente paga um pedaço no valor no pix e outro pedaço no cartão") --
  // lista de linhas, cada uma com método + parcelas (se crédito) + valor
  // daquela parte.
  const pagamentoIdSeq = useRef(1);
  const [pagamentos, setPagamentos] = useState(() => [{ id: 0, metodo: "pix" as MetodoPagamento, parcelas: PARCELAS[0], cents: 0 }]);

  function addPagamento() {
    setPagamentos((prev) => [...prev, { id: pagamentoIdSeq.current++, metodo: "pix" as MetodoPagamento, parcelas: PARCELAS[0], cents: 0 }]);
  }
  function removePagamento(id: number) {
    setPagamentos((prev) => prev.filter((p) => p.id !== id));
  }
  function updatePagamento(id: number, patch: Partial<(typeof pagamentos)[number]>) {
    setPagamentos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Frete -- pedido do Victor 23/09/2026: "também tem que ter o frete e a
  // opção de colocar o valor do frete". Entra na soma do valor final junto
  // com as formas de pagamento, mas não é uma forma de pagamento em si (por
  // isso fica fora da lista `pagamentos`, com seu próprio campo).
  const [freteCents, setFreteCents] = useState(0);

  const pagamentosTotalCents = pagamentos.reduce((sum, p) => sum + p.cents, 0);
  const valorFinalCents = pagamentosTotalCents + freteCents;

  // Junta tudo num único texto pro campo forma_pagamento (mesma coluna de
  // sempre, sem mudança de schema) -- "você mesmo juntaria tudo e mostrava
  // o valor final pra quem está solicitando" (pedido do Victor).
  const formaPagamento = [
    ...pagamentos
      .filter((p) => p.cents > 0)
      .map((p) => {
        const label = p.metodo === "credito" ? `${METODO_LABELS[p.metodo]} - ${p.parcelas}` : METODO_LABELS[p.metodo];
        return `${label}: ${formatMoney(p.cents)}`;
      }),
    ...(freteCents > 0 ? [`Frete: ${formatMoney(freteCents)}`] : []),
  ].join(" + ");

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
      <Field label="Data da venda">
        <input name="data_venda" type="date" className="rounded border px-3 py-2 max-w-[200px]" style={inputStyle} />
      </Field>

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
              onChange={(e) => updatePagamento(p.id, { metodo: e.target.value as MetodoPagamento })}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              {(Object.keys(METODO_LABELS) as MetodoPagamento[]).map((m) => (
                <option key={m} value={m}>
                  {METODO_LABELS[m]}
                </option>
              ))}
            </select>
            {p.metodo === "credito" ? (
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

      <Field label="Frete">
        <div className="max-w-[160px]">
          <MoneyFieldRaw cents={freteCents} onChange={setFreteCents} />
        </div>
      </Field>

      {/* Valor final = soma das formas de pagamento + frete -- calculado e
          mostrado pra quem está solicitando conferir, não digitado à mão
          (pedido do Victor 23/09/2026: "você mesmo juntaria tudo e mostrava
          o valor final pra quem está solicitando"). Vira o valor_reembolso
          de sempre via hidden input. */}
      <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: "var(--gridline)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Valor final do reembolso
        </span>
        <span className="text-lg font-bold tabular-nums" style={{ color: "var(--brand-green)" }}>
          {formatMoney(valorFinalCents)}
        </span>
      </div>
      <input type="hidden" name="valor_reembolso" value={(valorFinalCents / 100).toFixed(2)} />

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
