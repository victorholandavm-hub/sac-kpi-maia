"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createPedidoEncomendaAction,
  lookupTotvsClientForEncomenda,
  lookupTotvsProductForEncomenda,
  type FormState,
} from "@/app/assistencia/encomendas-actions";
import { INTERNAL_FABRICAS, EXTERNAL_FABRICAS } from "@/lib/fabricas";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

type Item = { produtoDescricao: string; produtoCodigo: string; quantidade: number };
type ProductLookupStatus = "idle" | "loading" | "found" | "not_found";

type Snapshot = {
  storeName: string;
  fornecedorLabel: string;
  clienteCodigo: string;
  vendedorName: string;
  notes: string;
  cupomFiscalName: string;
};

export function NovoPedidoEncomendaForm({
  fixedStoreName,
  storeOptions,
  showFornecedorPicker = true,
  allowExternal = true,
}: {
  fixedStoreName?: string;
  storeOptions?: { id: string; name: string }[];
  showFornecedorPicker?: boolean;
  // Operador de fábrica nunca lança pedido de fornecedor externo, mesmo
  // quando enxerga as duas fábricas próprias (ver comentário em
  // encomendas-actions.ts) -- então o picker, quando aparece pra esse
  // papel, mostra só as fábricas, sem a opção externa.
  allowExternal?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPedidoEncomendaAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [items, setItems] = useState<Item[]>([{ produtoDescricao: "", produtoCodigo: "", quantidade: 1 }]);
  const [productLookupStatus, setProductLookupStatus] = useState<Record<number, ProductLookupStatus>>({});
  const [fornecedorTipo, setFornecedorTipo] = useState<"fabrica_interna" | "fabrica_externa">("fabrica_interna");
  const [fabricaId, setFabricaId] = useState<string>(INTERNAL_FABRICAS[0].id);

  // Busca ao sair do campo (não debounced) -- pega o código do produto e
  // preenche a descrição, mesma ideia do código de cliente acima.
  function lookupItemProduct(index: number, code: string) {
    if (!code.trim()) {
      setProductLookupStatus((prev) => ({ ...prev, [index]: "idle" }));
      return;
    }
    setProductLookupStatus((prev) => ({ ...prev, [index]: "loading" }));
    lookupTotvsProductForEncomenda(code)
      .then((match) => {
        if (!match || !match.description) {
          setProductLookupStatus((prev) => ({ ...prev, [index]: "not_found" }));
          return;
        }
        updateItem(index, { produtoDescricao: match.description! });
        setProductLookupStatus((prev) => ({ ...prev, [index]: "found" }));
      })
      .catch(() => setProductLookupStatus((prev) => ({ ...prev, [index]: "not_found" })));
  }

  const [clienteCodigo, setClienteCodigo] = useState("");
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [clienteLookupStatus, setClienteLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  // Não existe campo de nome do cliente nesse pedido (só o código é
  // guardado) -- a busca aqui é só pra mostrar de quem é o código antes de
  // enviar, pra pegar erro de digitação. Não preenche nada.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!clienteCodigo.trim()) {
        setClienteLookupStatus("idle");
        return;
      }
      setClienteLookupStatus("loading");
      lookupTotvsClientForEncomenda(clienteCodigo)
        .then((match) => {
          if (!match) {
            setClienteNome(null);
            setClienteLookupStatus("not_found");
            return;
          }
          setClienteNome(match.name);
          setClienteLookupStatus("found");
        })
        .catch(() => setClienteLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [clienteCodigo]);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { produtoDescricao: "", produtoCodigo: "", quantidade: 1 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Não envia nada ainda -- só valida (mesma validação nativa do navegador
  // que rodaria no submit, só que sem submeter) e monta o resumo a partir do
  // form de verdade, pra não duplicar lógica dos campos não controlados
  // (vendedor, observações, cupom fiscal etc.).
  function handleRevisar() {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const storeId = String(fd.get("store_id") ?? "");
    const storeName = fixedStoreName ?? storeOptions?.find((s) => s.id === storeId)?.name ?? storeId;
    const fornecedorLabel =
      fornecedorTipo === "fabrica_externa"
        ? `Externo: ${String(fd.get("fornecedor_externo") ?? "")}`
        : (INTERNAL_FABRICAS.find((f) => f.id === fabricaId)?.nome ?? fabricaId);
    const cupom = fd.get("cupom_fiscal");

    setSnapshot({
      storeName,
      fornecedorLabel,
      clienteCodigo: String(fd.get("cliente_codigo") ?? "").trim(),
      vendedorName: String(fd.get("vendedor_name") ?? "").trim(),
      notes: String(fd.get("notes") ?? "").trim(),
      cupomFiscalName: cupom instanceof File && cupom.size > 0 ? cupom.name : "",
    });
    setReviewing(true);
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 max-w-xl">
      <div style={{ display: reviewing ? "none" : undefined }} className="flex flex-col gap-4">
        <FormSection title="Loja e cliente" number={1}>
          {storeOptions ? (
            <Field label="Loja *">
              <select name="store_id" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
                <option value="" disabled>
                  Selecione…
                </option>
                {storeOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Loja">
              <input
                value={fixedStoreName}
                disabled
                className="rounded border px-3 py-2"
                style={{ ...inputStyle, background: "var(--gridline)", color: "var(--text-secondary)" }}
              />
            </Field>
          )}

          <Field label="Código do cliente">
            <input
              name="cliente_codigo"
              value={clienteCodigo}
              onChange={(e) => setClienteCodigo(e.target.value)}
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
                Código não encontrado — pode enviar assim mesmo.
              </span>
            ) : null}
          </Field>
        </FormSection>

        {showFornecedorPicker ? (
          <FormSection title="Fornecedor" number={2}>
            <div className="flex flex-col gap-2">
              {INTERNAL_FABRICAS.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                  <input
                    type="radio"
                    name="fornecedor_tipo_radio"
                    checked={fornecedorTipo === "fabrica_interna" && fabricaId === f.id}
                    onChange={() => {
                      setFornecedorTipo("fabrica_interna");
                      setFabricaId(f.id);
                    }}
                  />
                  {f.nome}
                </label>
              ))}
              {allowExternal ? (
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                  <input
                    type="radio"
                    name="fornecedor_tipo_radio"
                    checked={fornecedorTipo === "fabrica_externa"}
                    onChange={() => setFornecedorTipo("fabrica_externa")}
                  />
                  Fornecedor externo
                </label>
              ) : null}
              <input type="hidden" name="fornecedor_tipo" value={fornecedorTipo} />
              {fornecedorTipo === "fabrica_interna" ? <input type="hidden" name="fabrica_id" value={fabricaId} /> : null}
              {fornecedorTipo === "fabrica_externa" ? (
                <select name="fornecedor_externo" required defaultValue="" className="rounded border px-3 py-2 ml-6" style={inputStyle}>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {EXTERNAL_FABRICAS.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </FormSection>
        ) : null}

        <FormSection title="Produtos" number={showFornecedorPicker ? 3 : 2} hint="Digite o código do produto pra preencher o nome automaticamente (se souber).">
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    name="item_produto_codigo"
                    value={item.produtoCodigo}
                    onChange={(e) => updateItem(i, { produtoCodigo: e.target.value })}
                    onBlur={(e) => lookupItemProduct(i, e.target.value)}
                    placeholder="Código"
                    className="w-28 rounded border px-3 py-2"
                    style={inputStyle}
                  />
                  <input
                    name="item_produto_descricao"
                    type="text"
                    value={item.produtoDescricao}
                    onChange={(e) => updateItem(i, { produtoDescricao: e.target.value })}
                    required
                    placeholder="Nome do produto"
                    className="flex-1 rounded border px-3 py-2"
                    style={inputStyle}
                  />
                  <input
                    name="item_quantidade"
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => updateItem(i, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-20 rounded border px-3 py-2"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="text-sm px-2 py-2 disabled:opacity-40"
                    style={{ color: "var(--status-critical)" }}
                    aria-label="Remover item"
                  >
                    remover
                  </button>
                </div>
                {productLookupStatus[i] === "loading" ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Buscando…
                  </span>
                ) : productLookupStatus[i] === "not_found" ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Código não encontrado.
                  </span>
                ) : null}
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-sm self-start underline" style={{ color: "var(--text-secondary)" }}>
              + adicionar produto
            </button>
          </div>
        </FormSection>

        <FormSection title="Detalhes" number={showFornecedorPicker ? 4 : 3}>
          <Field label="Vendedor responsável (opcional)">
            <input
              name="vendedor_name"
              placeholder="Pra qual vendedor(a) é essa venda"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>

          <Field label="Observações">
            <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>

          <Field label="Foto do cupom fiscal *">
            <input
              name="cupom_fiscal"
              type="file"
              required
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
          type="button"
          onClick={handleRevisar}
          className="rounded px-4 py-2 font-medium self-start"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Revisar pedido
        </button>
      </div>

      {reviewing && snapshot ? (
        <FormSection title="Confira antes de enviar" hint="Se algo estiver errado, volte e corrija — depois de enviado, dá pra editar até a fábrica/CD aceitar o pedido.">
          <div className="flex flex-col gap-3">
            <SummaryRow label="Loja" value={snapshot.storeName} />
            <SummaryRow label="Fornecedor" value={snapshot.fornecedorLabel} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Produtos
              </span>
              <ul className="text-sm flex flex-col gap-0.5" style={{ color: "var(--text-primary)" }}>
                {items
                  .filter((i) => i.produtoDescricao.trim())
                  .map((i, idx) => (
                    <li key={idx}>
                      {i.quantidade}x {i.produtoDescricao}
                      {i.produtoCodigo ? ` (${i.produtoCodigo})` : ""}
                    </li>
                  ))}
              </ul>
            </div>
            <SummaryRow label="Código do cliente" value={snapshot.clienteCodigo} />
            <SummaryRow label="Vendedor responsável" value={snapshot.vendedorName} />
            <SummaryRow label="Observações" value={snapshot.notes} />
            <SummaryRow label="Cupom fiscal" value={snapshot.cupomFiscalName} />
          </div>

          {state?.error ? (
            <p className="text-sm" style={{ color: "var(--status-critical)" }}>
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded px-4 py-2 font-medium disabled:opacity-60"
              style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
            >
              {pending ? "Enviando…" : "Confirmar e enviar"}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={pending}
              className="text-sm underline"
              style={{ color: "var(--text-secondary)" }}
            >
              Voltar e editar
            </button>
          </div>
        </FormSection>
      ) : null}
    </form>
  );
}
