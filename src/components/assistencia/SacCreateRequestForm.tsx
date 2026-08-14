"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { createSacRequest, lookupTotvsClientForTeam, lookupTotvsProductForTeam, type FormState } from "@/app/assistencia/actions";
import { withRetry } from "@/lib/retryLookup";
import {
  SAC_CATEGORIES,
  SAC_CATEGORY_LABELS,
  REQUEST_TYPE_LABELS,
  DELIVERY_REQUEST_TYPES,
  CAUSA_RAIZ_OPTIONS,
  CAUSA_RAIZ_LABELS,
} from "@/lib/assistenciaLabels";
import { ADDRESS_NUMBER_REQUIRED_TYPES, type Store } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

type SacType = "troca_produto" | "entrega_produto" | "envio_peca" | "notificacao_externa" | "montagem";

// Tipos que envolvem entrega pelo motorista (produto/peça + quem vai levar).
// "O que recolher" só se aplica a troca_produto — os outros dois não têm
// recolhimento nenhum.
const DELIVERY_TYPES: SacType[] = [...DELIVERY_REQUEST_TYPES];

// Montagem também tem produto (o móvel a montar), mas sem motorista -- quem
// vai até o cliente é um montador, atribuído depois por assistência/admin
// (o SAC só faz o intake, ver createSacRequest).
const PRODUCT_TYPES: SacType[] = [...DELIVERY_TYPES, "montagem"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

type Item = { product: string; quantity: number; code: string };
type ProductLookupStatus = "idle" | "loading" | "found" | "not_found";
const blankItem = (): Item => ({ product: "", quantity: 1, code: "" });

// Compartilhado entre a lista normal e a segunda lista do combo (montar +
// desmontar na mesma visita) -- mesmo desenho de PublicRequestForm.tsx.
function ItemsFields({
  items,
  lookupStatus,
  onUpdate,
  onAdd,
  onRemove,
  onLookup,
  namePrefix,
  productLabel,
}: {
  items: Item[];
  lookupStatus: Record<number, ProductLookupStatus>;
  onUpdate: (index: number, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onLookup: (index: number, code: string) => void;
  namePrefix: string;
  productLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              name={`${namePrefix}_code`}
              value={item.code}
              onChange={(e) => onUpdate(i, { code: e.target.value })}
              onBlur={(e) => onLookup(i, e.target.value)}
              placeholder="Código"
              className="w-28 rounded border px-2 py-2"
              style={inputStyle}
            />
            <input
              name={`${namePrefix}_product`}
              value={item.product}
              onChange={(e) => onUpdate(i, { product: e.target.value })}
              required
              placeholder={productLabel}
              className="flex-1 min-w-[140px] rounded border px-2 py-2"
              style={inputStyle}
            />
            <input
              name={`${namePrefix}_quantity`}
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => onUpdate(i, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-16 rounded border px-2 py-2"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              disabled={items.length === 1}
              className="text-sm px-2 py-2 disabled:opacity-40"
              style={{ color: "var(--status-critical)" }}
              aria-label="Remover item"
            >
              remover
            </button>
          </div>
          {lookupStatus[i] === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </span>
          ) : lookupStatus[i] === "not_found" ? (
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              Código não encontrado.
              <button type="button" onClick={() => onLookup(i, item.code)} className="underline" style={{ color: "var(--text-secondary)" }}>
                🔄 Tentar de novo
              </button>
            </span>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="text-sm self-start underline" style={{ color: "var(--text-secondary)" }}>
        + adicionar produto
      </button>
    </div>
  );
}


export function SacCreateRequestForm({
  stores,
  drivers,
  cargas,
}: {
  stores: Store[];
  drivers: string[];
  cargas: { carga: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSacRequest, undefined);
  const [type, setType] = useState<SacType>("troca_produto");
  const isDelivery = DELIVERY_TYPES.includes(type);
  const showProduct = PRODUCT_TYPES.includes(type);
  // Só existe pra troca_produto -- controla se carga/conferente aparecem
  // como obrigatórios (ver "Detalhes" abaixo e a validação espelhada em
  // createSacRequest).
  const [causaRaiz, setCausaRaiz] = useState("");

  const [clientCode, setClientCode] = useState("");
  const [clientCpf, setClientCpf] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientNeighborhood, setClientNeighborhood] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [isApartment, setIsApartment] = useState(false);
  const [addressComplement, setAddressComplement] = useState("");
  const [clientLookupStatus, setClientLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  // Só montagem envolve entrar num prédio de verdade -- SAC nem oferece
  // desmontagem isolada (ver SacType acima).
  const showAddressNumber = (ADDRESS_NUMBER_REQUIRED_TYPES as readonly string[]).includes(type);

  // Combo só existe pra montagem -- SAC nem oferece desmontagem isolada (ver
  // SacType). "item" é a lista principal (produtos a entregar, ou a montar
  // quando o type é montagem); "item_secondary" só existe com o combo
  // marcado, e é sempre "a desmontar" (não tem o inverso, já que SAC não
  // cria desmontagem sozinha).
  const [combo, setCombo] = useState(false);
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [itemsLookupStatus, setItemsLookupStatus] = useState<Record<number, ProductLookupStatus>>({});
  const [secondaryItems, setSecondaryItems] = useState<Item[]>([blankItem()]);
  const [secondaryLookupStatus, setSecondaryLookupStatus] = useState<Record<number, ProductLookupStatus>>({});

  function makeItemHandlers(
    setList: React.Dispatch<React.SetStateAction<Item[]>>,
    setStatus: React.Dispatch<React.SetStateAction<Record<number, ProductLookupStatus>>>
  ) {
    function update(index: number, patch: Partial<Item>) {
      setList((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    }
    function add() {
      setList((prev) => [...prev, blankItem()]);
    }
    function remove(index: number) {
      setList((prev) => prev.filter((_, i) => i !== index));
    }
    function lookup(index: number, code: string) {
      if (!code.trim()) {
        setStatus((prev) => ({ ...prev, [index]: "idle" }));
        return;
      }
      setStatus((prev) => ({ ...prev, [index]: "loading" }));
      withRetry(() => lookupTotvsProductForTeam(code))
        .then((match) => {
          if (!match || !match.description) {
            setStatus((prev) => ({ ...prev, [index]: "not_found" }));
            return;
          }
          update(index, { product: match.description! });
          setStatus((prev) => ({ ...prev, [index]: "found" }));
        })
        .catch(() => setStatus((prev) => ({ ...prev, [index]: "not_found" })));
    }
    return { update, add, remove, lookup };
  }

  const itemHandlers = makeItemHandlers(setItems, setItemsLookupStatus);
  const secondaryHandlers = makeItemHandlers(setSecondaryItems, setSecondaryLookupStatus);

  // Extraído do effect abaixo pra também poder ser chamado pelo botão
  // "Tentar de novo" (aparece quando não encontrou -- ver clientLookupStatus
  // === "not_found" mais abaixo).
  function runClientLookup(code: string) {
    if (!code.trim()) {
      setClientLookupStatus("idle");
      return;
    }
    setClientLookupStatus("loading");
    withRetry(() => lookupTotvsClientForTeam(code))
      .then((match) => {
        if (!match) {
          setClientLookupStatus("not_found");
          return;
        }
        setClientName(match.name);
        if (match.phone1) setClientPhone(match.phone1);
        if (match.addressStreet) setClientAddress(match.addressStreet);
        if (match.addressNumber) setAddressNumber(match.addressNumber);
        if (match.addressComplement) {
          setIsApartment(true);
          setAddressComplement(match.addressComplement);
        }
        if (match.addressNeighborhood) setClientNeighborhood(match.addressNeighborhood);
        setClientLookupStatus("found");
      })
      .catch(() => setClientLookupStatus("not_found"));
  }

  // Mesma ideia de PublicRequestForm.tsx: código é só atalho, não trava nada
  // se não achar -- a pessoa preenche à mão como já era.
  useEffect(() => {
    const timer = setTimeout(() => runClientLookup(clientCode), 400);
    return () => clearTimeout(timer);
  }, [clientCode]);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Tipo e loja" number={1}>
        <Field label="Tipo">
          <select
            name="type"
            value={type}
            onChange={(e) => {
              const next = e.target.value as SacType;
              setType(next);
              if (next !== "montagem") setCombo(false);
            }}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="troca_produto">{REQUEST_TYPE_LABELS.troca_produto} (recolher + entregar)</option>
            <option value="entrega_produto">{REQUEST_TYPE_LABELS.entrega_produto} (sem recolhimento)</option>
            <option value="envio_peca">{REQUEST_TYPE_LABELS.envio_peca}</option>
            <option value="notificacao_externa">Notificação externa (sem troca de produto)</option>
            <option value="montagem">{REQUEST_TYPE_LABELS.montagem}</option>
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

      <FormSection
        title="Dados do cliente"
        number={2}
        hint="Digite o código do cliente pra preencher o resto automaticamente (se souber). É obrigatório informar o código do cliente ou o CPF (pelo menos um)."
      >
        <Field label={`Código do cliente${clientCpf.trim() ? "" : " *"}`}>
          <input
            name="client_protheus_code"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            required={!clientCpf.trim()}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
          {clientLookupStatus === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </span>
          ) : clientLookupStatus === "found" ? (
            <span className="text-xs" style={{ color: "var(--status-good)" }}>
              Cliente encontrado — confira os dados abaixo.
            </span>
          ) : clientLookupStatus === "not_found" ? (
            <span className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-muted)" }}>
              Código não encontrado — preencha os dados abaixo à mão.
              <button
                type="button"
                onClick={() => runClientLookup(clientCode)}
                className="underline"
                style={{ color: "var(--text-secondary)" }}
              >
                🔄 Tentar de novo
              </button>
            </span>
          ) : null}
        </Field>

        <Field label={`CPF do cliente${clientCode.trim() ? "" : " *"}`}>
          <input
            name="client_cpf"
            value={clientCpf}
            onChange={(e) => setClientCpf(e.target.value)}
            required={!clientCode.trim()}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <Field label="Nome do cliente *">
          <input
            name="client_name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Telefone *">
            <input
              name="client_phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              required
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
          <Field label="Endereço *">
            <input
              name="client_address"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              required
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Bairro *">
          <input
            name="client_neighborhood"
            value={clientNeighborhood}
            onChange={(e) => setClientNeighborhood(e.target.value)}
            required
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        {showAddressNumber ? (
          <div className="flex flex-col gap-3">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Número *">
                <input
                  name="client_address_number"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  required
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm self-end pb-2" style={{ color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  name="client_is_apartment"
                  checked={isApartment}
                  onChange={(e) => setIsApartment(e.target.checked)}
                  className="rounded"
                />
                É apartamento/prédio?
              </label>
            </div>
            {isApartment ? (
              <Field label="Apto/Bloco *">
                <input
                  name="client_address_complement"
                  value={addressComplement}
                  onChange={(e) => setAddressComplement(e.target.value)}
                  required
                  placeholder="Ex: Apto 302, Bloco B"
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </FormSection>

      {showProduct ? (
        <FormSection
          title={type === "montagem" ? (combo ? "Móveis a montar" : "Móvel(is) a montar") : "Produto(s) e entrega"}
          number={3}
          hint="Digite o código do produto pra preencher o nome automaticamente (se souber)."
        >
          <ItemsFields
            items={items}
            lookupStatus={itemsLookupStatus}
            onUpdate={itemHandlers.update}
            onAdd={itemHandlers.add}
            onRemove={itemHandlers.remove}
            onLookup={itemHandlers.lookup}
            namePrefix="item"
            productLabel="Ex: Super Box Confort Mola Ensacada"
          />

          {type === "montagem" ? (
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                name="combo_montagem_desmontagem"
                checked={combo}
                onChange={(e) => setCombo(e.target.checked)}
                className="rounded"
              />
              Também precisa desmontar o móvel antigo
            </label>
          ) : null}

          {isDelivery ? (
            <Field label={type === "troca_produto" && causaRaiz === "erro_motorista" ? "Motorista *" : "Motorista"}>
              <input
                name="driver_name"
                list="sac-drivers"
                required={type === "troca_produto" && causaRaiz === "erro_motorista"}
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
              <datalist id="sac-drivers">
                {drivers.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
          ) : null}
        </FormSection>
      ) : null}

      {combo ? (
        <FormSection title="Móveis a desmontar" number={4}>
          <ItemsFields
            items={secondaryItems}
            lookupStatus={secondaryLookupStatus}
            onUpdate={secondaryHandlers.update}
            onAdd={secondaryHandlers.add}
            onRemove={secondaryHandlers.remove}
            onLookup={secondaryHandlers.lookup}
            namePrefix="item_secondary"
            productLabel="Ex: Roupeiro antigo"
          />
        </FormSection>
      ) : null}

      <FormSection title="Detalhes" number={5} hint="Conte o que aconteceu, com o máximo de detalhe que puder.">
        <Field label="Motivo *">
          <textarea name="reason" rows={2} required placeholder="Ex: produto entregue com avaria" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        {type === "troca_produto" ? (
          <Field label="Causa raiz *">
            <select
              name="causa_raiz"
              required
              value={causaRaiz}
              onChange={(e) => setCausaRaiz(e.target.value)}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {CAUSA_RAIZ_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CAUSA_RAIZ_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {type === "troca_produto" && causaRaiz === "erro_conferencia" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              Erro de conferência -- precisa registrar qual carga e quem conferiu antes de seguir com a troca.
            </p>
            <Field label="Carga *">
              <input
                name="causa_carga"
                list="sac-cargas"
                required
                placeholder="Ex: 000123"
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
              <datalist id="sac-cargas">
                {cargas.map((c) => (
                  <option key={c.carga} value={c.carga}>
                    {c.label}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Conferente *">
              <input
                name="causa_conferente"
                required
                placeholder="Nome de quem conferiu a carga"
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
          </div>
        ) : null}

        {type === "troca_produto" && causaRaiz === "erro_motorista" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              Erro do motorista -- precisa registrar qual carga, e o nome dele no campo &quot;Motorista&quot; lá em cima.
            </p>
            <Field label="Carga *">
              <input
                name="causa_carga"
                list="sac-cargas"
                required
                placeholder="Ex: 000123"
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
              <datalist id="sac-cargas">
                {cargas.map((c) => (
                  <option key={c.carga} value={c.carga}>
                    {c.label}
                  </option>
                ))}
              </datalist>
            </Field>
          </div>
        ) : null}

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

        <Field label="Foto ou PDF da notificação *">
          <input
            name="photo"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
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
