"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createQuickRequest,
  lookupTotvsClientForTeam,
  lookupTotvsProductForTeam,
  getDayLoadAction,
  type FormState,
} from "@/app/assistencia/actions";
import { withRetry } from "@/lib/retryLookup";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS, MANOEL_ONLY_TYPES, MANOEL_ONLY_ASSEMBLER } from "@/lib/assistenciaLabels";
import { SHIFTS, ADDRESS_NUMBER_REQUIRED_TYPES, type Store, type DayLoadItem } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

// "Nova visita" -- só os tipos de montador de verdade (pedido do Victor
// 18/08/2026: "hoje temos uma aba de visitas e uma aba de entregas, tem que
// ser dois formulários separados"). Recolhimento de peça saiu daqui em
// 18/08/2026 (é entrega, não visita) -- tem formulário próprio, ver
// NovaEntregaAssistenciaForm.tsx.
const ASSISTENCIA_TYPES = ["montagem", "desmontagem", "troca_peca", "vistoria"] as const;
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

type Item = { product: string; quantity: number; code: string; unitValue: string };
type ProductLookupStatus = "idle" | "loading" | "found" | "not_found";
const blankItem = (): Item => ({ product: "", quantity: 1, code: "", unitValue: "" });

// Compartilhado entre a lista normal e a segunda lista do combo (montar +
// desmontar na mesma visita) -- mesma ideia de PublicRequestForm.tsx, com um
// campo de valor a mais porque "Nova rápida" é usada também a partir de
// Pagamentos pra já sair com o valor definido, sem precisar abrir o chamado
// depois só pra isso.
function ItemsFields({
  items,
  lookupStatus,
  onUpdate,
  onAdd,
  onRemove,
  onLookup,
  namePrefix,
  codeRequired,
}: {
  items: Item[];
  lookupStatus: Record<number, ProductLookupStatus>;
  onUpdate: (index: number, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onLookup: (index: number, code: string) => void;
  namePrefix: string;
  // Montagem/desmontagem exige o código (pedido do Victor 15/08/2026); os
  // outros tipos continuam com o código opcional, só como atalho pra
  // autopreencher o nome do produto.
  codeRequired?: boolean;
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
              required={codeRequired}
              placeholder="Código"
              className="w-28 rounded border px-2 py-2"
              style={inputStyle}
            />
            <input
              name={`${namePrefix}_product`}
              value={item.product}
              onChange={(e) => onUpdate(i, { product: e.target.value })}
              required
              placeholder="Ex: Roupeiro Giardino"
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
            <input
              name={`${namePrefix}_unit_value`}
              type="number"
              min={0}
              step="0.01"
              value={item.unitValue}
              onChange={(e) => onUpdate(i, { unitValue: e.target.value })}
              placeholder="Valor (R$)"
              className="w-28 rounded border px-2 py-2"
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


export function QuickCreateRequestForm({
  stores,
  assemblers,
  includeSacTypes,
}: {
  stores: Store[];
  assemblers: { name: string; storeId: string | null }[];
  includeSacTypes: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createQuickRequest, undefined);
  const TYPES = includeSacTypes ? [...ASSISTENCIA_TYPES, SAC_TYPE] : ASSISTENCIA_TYPES;
  const [type, setType] = useState<string>("vistoria");
  const [storeId, setStoreId] = useState("");
  const isManoelOnly = (MANOEL_ONLY_TYPES as readonly string[]).includes(type);
  const showCombo = type === "montagem" || type === "desmontagem";
  // Pedido do Victor 15/08/2026: código do produto passa a ser obrigatório
  // pra montagem/desmontagem -- validado de novo no servidor (ver
  // createQuickRequest), isso aqui é só o feedback imediato no navegador.
  const codeRequired = showCombo;
  // Mesmos tipos de EditRequestForm.tsx -- só quem passa por montador/técnico.
  const showMontadorInstruction = ASSISTENCIA_TYPES.includes(type as (typeof ASSISTENCIA_TYPES)[number]);
  // Montador da loja escolhida + globais/legado (store_id nulo) -- a loja só
  // é escolhida aqui no formulário, então o filtro é no cliente.
  const visibleAssemblers = assemblers.filter((a) => a.storeId === null || a.storeId === storeId);

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
  // Só montagem/desmontagem envolve entrar num prédio de verdade -- ver
  // ADDRESS_NUMBER_REQUIRED_TYPES em serviceRequests.ts.
  const showAddressNumber = (ADDRESS_NUMBER_REQUIRED_TYPES as readonly string[]).includes(type);

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
        // CPF ficava faltando aqui -- achado do Victor 02/09/2026, ver mesmo
        // comentário em SacCreateRequestForm.tsx.
        setClientCpf(match.cpfCnpj);
        if (match.phone1) setClientPhone(match.phone1);
        if (match.addressStreet) setClientAddress(match.addressStreet);
        if (match.addressNeighborhood) setClientNeighborhood(match.addressNeighborhood);
        if (match.addressNumber) setAddressNumber(match.addressNumber);
        if (match.addressComplement) {
          setIsApartment(true);
          setAddressComplement(match.addressComplement);
        }
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

  // Assim que escolhe a data, mostra quantas e quais demandas já existem
  // naquele dia -- pedido pra não precisar sair do formulário e ir checar a
  // agenda à parte só pra saber se dá pra encaixar mais uma visita.
  const [scheduledDate, setScheduledDate] = useState("");
  const [dayLoad, setDayLoad] = useState<DayLoadItem[] | null>(null);
  const [dayLoadLoading, setDayLoadLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!scheduledDate) {
        setDayLoad(null);
        return;
      }
      setDayLoadLoading(true);
      getDayLoadAction(scheduledDate)
        .then((items) => setDayLoad(items))
        .catch(() => setDayLoad(null))
        .finally(() => setDayLoadLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [scheduledDate]);

  // Sem combo, "item" é a lista única de sempre. Com combo, "item" continua
  // sendo os produtos do type principal e "item_secondary" os da ação oposta
  // -- mesmo desenho de PublicRequestForm.tsx.
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

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Loja e tipo" number={1}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Loja *">
            <select
              name="store_id"
              required
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
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
              onChange={(e) => {
                const next = e.target.value;
                setType(next);
                if (next !== "montagem" && next !== "desmontagem") setCombo(false);
              }}
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
            <input
              type="checkbox"
              name="combo_montagem_desmontagem"
              checked={combo}
              onChange={(e) => setCombo(e.target.checked)}
              className="rounded"
            />
            {type === "montagem" ? "Também precisa desmontar o móvel antigo" : "Também precisa montar o móvel novo"}
          </label>
        ) : null}
      </FormSection>

      <FormSection
        title="Dados do cliente"
        number={2}
        hint="Digite o código do cliente pra preencher o resto automaticamente (se souber) — é obrigatório."
      >
        <Field label="Código do cliente *">
          <input
            name="client_protheus_code"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            required
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

        <Field label="CPF do cliente *">
          <input
            name="client_cpf"
            value={clientCpf}
            onChange={(e) => setClientCpf(e.target.value)}
            required
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

        <Field label="O que precisa ser feito *">
          <textarea name="reason" rows={2} required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        {showMontadorInstruction ? (
          <Field label="Instrução pro montador (visível pra ele, separado do campo acima)">
            <textarea
              name="montador_instruction"
              rows={2}
              placeholder="Ex: cliente prefere que chegue depois das 14h, subir móvel pelo elevador de serviço…"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        ) : null}
      </FormSection>

      <FormSection title="Agendamento e responsável" number={3}>
        <div className="grid sm:grid-cols-4 gap-4">
          <Field label="Data agendada">
            <input
              name="scheduled_date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
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
          {showMontadorInstruction ? (
            <Field label="Técnico/montador">
              {isManoelOnly ? (
                <input
                  name="assembler_name"
                  value={MANOEL_ONLY_ASSEMBLER}
                  readOnly
                  className="rounded border px-3 py-2"
                  style={{ ...inputStyle, background: "var(--gridline)", color: "var(--text-secondary)" }}
                />
              ) : (
                <>
                  <input name="assembler_name" list="quick-assemblers" className="rounded border px-3 py-2" style={inputStyle} />
                  <datalist id="quick-assemblers">
                    {visibleAssemblers.map((a) => (
                      <option key={a.name} value={a.name} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          ) : null}
        </div>

        {scheduledDate ? (
          <div className="rounded-lg p-3 flex flex-col gap-1.5" style={{ background: "var(--gridline)" }}>
            {dayLoadLoading ? (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Verificando a agenda desse dia…
              </span>
            ) : dayLoad === null ? null : dayLoad.length === 0 ? (
              <span className="text-xs font-medium" style={{ color: "var(--status-good)" }}>
                Nenhuma visita agendada ainda nesse dia.
              </span>
            ) : (
              <>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {dayLoad.length} visita{dayLoad.length > 1 ? "s" : ""} já {dayLoad.length > 1 ? "agendadas" : "agendada"} nesse dia:
                </span>
                <ul className="flex flex-col gap-0.5">
                  {dayLoad.map((item) => (
                    <li key={item.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      #{item.ticketNumber} · {REQUEST_TYPE_LABELS[item.type] ?? item.type} · {item.storeName}
                      {item.clientName ? ` · ${item.clientName}` : ""}
                      {item.clientNeighborhood ? ` · 📍 ${item.clientNeighborhood}` : ""}
                      {item.scheduledTime ? ` · ${item.scheduledTime.slice(0, 5)}` : item.shift ? ` · ${SHIFT_LABELS[item.shift]}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title={combo ? `Produtos a ${type === "montagem" ? "montar" : "desmontar"} (pagamento)` : "Produtos (pagamento)"}
        number={4}
        hint={
          codeRequired
            ? "Código do produto obrigatório. Valor é opcional — dá pra definir depois em Pagamentos."
            : "Digite o código do produto pra preencher o nome automaticamente (se souber). Valor é opcional — dá pra definir depois em Pagamentos."
        }
      >
        <ItemsFields
          items={items}
          lookupStatus={itemsLookupStatus}
          onUpdate={itemHandlers.update}
          onAdd={itemHandlers.add}
          onRemove={itemHandlers.remove}
          onLookup={itemHandlers.lookup}
          namePrefix="item"
          codeRequired={codeRequired}
        />
      </FormSection>

      {combo ? (
        <FormSection
          title={`Produtos a ${type === "montagem" ? "desmontar" : "montar"} (pagamento)`}
          number={5}
          hint={codeRequired ? "Código do produto obrigatório." : undefined}
        >
          <ItemsFields
            items={secondaryItems}
            lookupStatus={secondaryLookupStatus}
            onUpdate={secondaryHandlers.update}
            onAdd={secondaryHandlers.add}
            onRemove={secondaryHandlers.remove}
            onLookup={secondaryHandlers.lookup}
            namePrefix="item_secondary"
            codeRequired={codeRequired}
          />
        </FormSection>
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
        {pending ? "Criando…" : "Criar"}
      </button>
    </form>
  );
}
