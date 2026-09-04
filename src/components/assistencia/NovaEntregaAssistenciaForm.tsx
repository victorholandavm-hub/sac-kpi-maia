"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createQuickRequest,
  lookupTotvsClientForTeam,
  lookupTotvsProductForTeam,
  getAvailableRotasForDateAction,
  type FormState,
} from "@/app/assistencia/actions";
import { withRetry } from "@/lib/retryLookup";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS, CAUSA_RAIZ_OPTIONS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";
import { SHIFTS, ADDRESS_NUMBER_REQUIRED_TYPES, type Store } from "@/lib/serviceRequests";
import { CITY_LABELS, ROTA_CITY, labelAvailableRota, type AvailableRota, type RotaCity } from "@/lib/rotas";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

// Assistência cria os três tipos de peça que vão por motorista -- troca de
// peça continua sendo visita de montador, não entra aqui (pedido do Victor
// 18/08/2026, confirmado depois de eu ter classificado errado).
// "envio_recolhimento_peca" (pedido do Victor 02/09/2026) -- visita
// combinada, uma peça vai e outra volta na mesma ida do motorista.
const ENTREGA_TYPES = ["recolhimento", "envio_peca", "envio_recolhimento_peca"] as const;
type EntregaType = (typeof ENTREGA_TYPES)[number];

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

// Hook local -- peça a enviar e peça a recolher (combo envio_recolhimento_peca)
// usam exatamente o mesmo estado e as mesmas 4 funções, só duas instâncias
// separadas (mesmo padrão de useItemsList em SacCreateRequestForm.tsx, pro
// combo troca_produto entregar/recolher de PRODUTO).
function useItemsList() {
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [lookupStatus, setLookupStatus] = useState<Record<number, ProductLookupStatus>>({});

  function update(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function add() {
    setItems((prev) => [...prev, blankItem()]);
  }
  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function lookup(index: number, code: string) {
    if (!code.trim()) {
      setLookupStatus((prev) => ({ ...prev, [index]: "idle" }));
      return;
    }
    setLookupStatus((prev) => ({ ...prev, [index]: "loading" }));
    withRetry(() => lookupTotvsProductForTeam(code))
      .then((match) => {
        if (!match || !match.description) {
          setLookupStatus((prev) => ({ ...prev, [index]: "not_found" }));
          return;
        }
        update(index, { product: match.description! });
        setLookupStatus((prev) => ({ ...prev, [index]: "found" }));
      })
      .catch(() => setLookupStatus((prev) => ({ ...prev, [index]: "not_found" })));
  }

  return { items, lookupStatus, update, add, remove, lookup };
}

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
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Código não encontrado.
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

// "Nova entrega" da Assistência -- recolhimento e envio de peça (pedido do
// Victor 18/08/2026: aba de entregas separada da aba de visitas, cada uma
// com seu próprio formulário; sem nada de montador/pagamento por item, que
// é coisa de visita). Mesmo tratamento do envio de peça no SAC
// (SacCreateRequestForm.tsx) -- os dois tipos usam os mesmos campos daqui
// pra frente, só o rótulo do produto muda.
export function NovaEntregaAssistenciaForm({
  stores,
  drivers,
  cargas,
}: {
  stores: Store[];
  drivers: string[];
  cargas: { carga: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createQuickRequest, undefined);
  const [type, setType] = useState<EntregaType>("recolhimento");
  const showAddressNumber = (ADDRESS_NUMBER_REQUIRED_TYPES as readonly string[]).includes(type);

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

  useEffect(() => {
    const timer = setTimeout(() => runClientLookup(clientCode), 400);
    return () => clearTimeout(timer);
  }, [clientCode]);

  const [causaRaiz, setCausaRaiz] = useState("");

  // Rota/motorista -- mesmo desenho de SacCreateRequestForm.tsx. Cidade
  // primeiro, rota depois -- pedido do Victor 24/08/2026.
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedCity, setSelectedCity] = useState<RotaCity>("joao_pessoa");
  // Id da atribuição (não só a rota) -- mesmo motivo de
  // SacCreateRequestForm.tsx (rota extra genérica de JP pode repetir o
  // mesmo valor de `rota` em duas linhas do mesmo dia).
  const [selectedRotaId, setSelectedRotaId] = useState("");
  const [availableRotas, setAvailableRotas] = useState<AvailableRota[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const hasDateContext = !!scheduledDate;

  useEffect(() => {
    if (!hasDateContext) {
      return;
    }
    const timer = setTimeout(() => {
      setLoadingRotas(true);
      getAvailableRotasForDateAction(scheduledDate)
        .then((rotas) => {
          setAvailableRotas(rotas);
          setSelectedRotaId((prev) => (prev && !rotas.some((r) => r.id === prev) ? "" : prev));
        })
        .catch(() => setAvailableRotas([]))
        .finally(() => setLoadingRotas(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [hasDateContext, scheduledDate]);

  const effectiveAvailableRotas = (hasDateContext ? availableRotas : []).filter((r) => ROTA_CITY[r.rota] === selectedCity);
  const effectiveLoadingRotas = hasDateContext && loadingRotas;
  const previewDriverName = effectiveAvailableRotas.find((r) => r.id === selectedRotaId)?.driverName ?? null;

  const { items, lookupStatus: itemsLookupStatus, update, add, remove, lookup } = useItemsList();
  // Só usada quando type === "envio_recolhimento_peca" -- mas o hook
  // precisa ser chamado sempre, sem condição (mesmo motivo de
  // SacCreateRequestForm.tsx).
  const {
    items: pickupItems,
    lookupStatus: pickupItemsLookupStatus,
    update: updatePickup,
    add: addPickup,
    remove: removePickup,
    lookup: lookupPickup,
  } = useItemsList();
  const isEnvioRecolhimento = type === "envio_recolhimento_peca";

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Tipo e loja" number={1}>
        <Field label="Tipo">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as EntregaType)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            {ENTREGA_TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
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
      </FormSection>

      <FormSection title={type === "recolhimento" ? "Peça a recolher" : "Peça a enviar"} number={3}
        hint="Digite o código do produto pra preencher o nome automaticamente (se souber)."
      >
        <ItemsFields
          items={items}
          lookupStatus={itemsLookupStatus}
          onUpdate={update}
          onAdd={add}
          onRemove={remove}
          onLookup={lookup}
          namePrefix="item"
          productLabel="Ex: Puxador de roupeiro"
        />

        {/* Combo envio+recolhimento (pedido do Victor 02/09/2026) -- 2ª
            lista, obrigatória, igual ao "Produtos a recolher" que
            troca_produto já tem em SacCreateRequestForm.tsx. Server action
            (createQuickRequest) também exige pelo menos 1 item aqui. */}
        {isEnvioRecolhimento ? (
          <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Peça a recolher *
            </span>
            <ItemsFields
              items={pickupItems}
              lookupStatus={pickupItemsLookupStatus}
              onUpdate={updatePickup}
              onAdd={addPickup}
              onRemove={removePickup}
              onLookup={lookupPickup}
              namePrefix="pickup_item"
              productLabel="Ex: Puxador de roupeiro (a recolher)"
            />
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Motivo e responsáveis" number={4}>
        <Field label="O que precisa ser feito *">
          <textarea name="reason" rows={2} required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        <Field label="Autorizado por *">
          <input
            name="authorized_by"
            required
            placeholder="Nome de quem autorizou (gerente, supervisor…)"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <Field label="Restrição de horário do cliente">
          <input
            name="client_time_restriction"
            placeholder="Ex: só de manhã, ou das 14h às 17h"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <Field label="Quem errou (controle interno) *">
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

        {causaRaiz === "erro_conferencia" || causaRaiz === "sujeira_conferencia" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              {causaRaiz === "sujeira_conferencia"
                ? "Sujeira não barrada na conferência -- precisa registrar qual carga e quem conferiu antes de seguir."
                : "Erro de conferência -- precisa registrar qual carga e quem conferiu antes de seguir."}
            </p>
            <Field label="Carga *">
              <input name="causa_carga" list="entrega-cargas" required placeholder="Ex: 000123" className="rounded border px-3 py-2" style={inputStyle} />
              <datalist id="entrega-cargas">
                {cargas.map((c) => (
                  <option key={c.carga} value={c.carga}>
                    {c.label}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Conferente *">
              <input name="causa_conferente" required placeholder="Nome de quem conferiu a carga" className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
          </div>
        ) : null}

        {causaRaiz === "erro_motorista" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              Erro do motorista -- precisa registrar qual carga e quem foi.
            </p>
            <Field label="Carga *">
              <input name="causa_carga" list="entrega-cargas" required placeholder="Ex: 000123" className="rounded border px-3 py-2" style={inputStyle} />
              <datalist id="entrega-cargas">
                {cargas.map((c) => (
                  <option key={c.carga} value={c.carga}>
                    {c.label}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Motorista (erro) *">
              <input name="driver_name" list="entrega-drivers" required className="rounded border px-3 py-2" style={inputStyle} />
              <datalist id="entrega-drivers">
                {drivers.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
          </div>
        ) : null}

        {/* Pedido do Victor 04/09/2026: "quando for erro do vendedor,
            obrigatorio colocar o nome do vendedor" -- mesmo padrão visual
            de erro_conferencia/erro_motorista acima. */}
        {causaRaiz === "erro_vendedor" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              Erro do vendedor -- precisa registrar quem foi.
            </p>
            <Field label="Vendedor(a) *">
              <input name="seller_name" required placeholder="Nome de quem vendeu" className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
          </div>
        ) : null}

        {/* "Outro" precisa dizer exatamente o que houve -- pedido do
            Victor 21/08/2026, mesmo padrão de erro_conferencia/
            erro_motorista acima. */}
        {causaRaiz === "outro" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              Causa raiz &quot;Outro&quot; -- descreva exatamente o que houve, pra dar pra apurar depois.
            </p>
            <Field label="O que houve, exatamente *">
              <textarea
                name="causa_raiz_detalhe"
                rows={2}
                required
                placeholder="Descreva a causa raiz com o máximo de detalhe"
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Agendamento" number={5}>
        <div className="flex items-center gap-2 flex-wrap">
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
          {/* Independente do turno desde 27/08/2026 (pedido do Victor) --
              pode vir junto de qualquer período, ou sozinho. */}
          <label className="flex items-center gap-2 text-sm self-end pb-2" style={{ color: "var(--text-primary)" }}>
            <input type="checkbox" name="urgent" className="rounded" />
            Urgente
          </label>
        </div>

        {/* Cidade primeiro, rota depois -- pedido do Victor 24/08/2026. */}
        <Field label="Cidade">
          <div className="flex items-center gap-2">
            {(["joao_pessoa", "campina_grande"] as RotaCity[]).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  setSelectedCity(city);
                  setSelectedRotaId("");
                }}
                className="text-xs px-3 py-1.5 rounded-full border font-medium"
                style={{
                  borderColor: "var(--border)",
                  background: selectedCity === city ? "var(--brand-green)" : "transparent",
                  color: selectedCity === city ? "var(--brand-green-ink)" : "var(--text-secondary)",
                }}
              >
                {CITY_LABELS[city]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Rota">
          <select
            name="rotaAssignmentId"
            value={selectedRotaId}
            onChange={(e) => setSelectedRotaId(e.target.value)}
            disabled={!scheduledDate || effectiveLoadingRotas}
            className="rounded border px-3 py-2 disabled:opacity-60"
            style={inputStyle}
          >
            <option value="">Sem rota</option>
            {effectiveAvailableRotas.map((r) => (
              <option key={r.id} value={r.id}>
                {labelAvailableRota(effectiveAvailableRotas, r)}
              </option>
            ))}
          </select>
        </Field>
        {!scheduledDate ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Escolha a data agendada pra ver as rotas disponíveis.
          </p>
        ) : effectiveLoadingRotas ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Carregando rotas…
          </p>
        ) : effectiveAvailableRotas.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--status-warning)" }}>
            Nenhuma rota de {CITY_LABELS[selectedCity]} disponível pra essa data.
          </p>
        ) : selectedRotaId ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Motorista: {previewDriverName ?? "nenhum escolhido ainda"}
          </p>
        ) : null}
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
        {pending ? "Criando…" : "Criar"}
      </button>
    </form>
  );
}
