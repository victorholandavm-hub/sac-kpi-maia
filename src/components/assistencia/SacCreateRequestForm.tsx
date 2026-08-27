"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  createSacRequest,
  lookupTotvsClientForTeam,
  lookupTotvsProductForTeam,
  getAvailableRotasForDateAction,
  type FormState,
} from "@/app/assistencia/actions";
import { withRetry } from "@/lib/retryLookup";
import {
  SAC_CATEGORIES,
  SAC_CATEGORY_LABELS,
  REQUEST_TYPE_LABELS,
  CAUSA_RAIZ_OPTIONS,
  CAUSA_RAIZ_LABELS,
  SHIFT_LABELS,
} from "@/lib/assistenciaLabels";
import { ADDRESS_NUMBER_REQUIRED_TYPES, SHIFTS, type Store } from "@/lib/serviceRequests";
import { CITY_LABELS, ROTA_CITY, labelAvailableRota, type AvailableRota, type RotaCity } from "@/lib/rotas";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

// "Nova entrega" do SAC -- pedido do Victor 18/08/2026: aba de entregas
// separada da aba de visitas, cada uma com formulário próprio. Montagem
// saiu daqui (é visita, não entrega) -- tem formulário próprio, ver
// SacNovaVisitaForm.tsx. "recolhimento" (de peça) NÃO entra aqui -- só a
// Assistência cria (ver NovaEntregaAssistenciaForm.tsx). "recolhimento_produto"
// entrou em 18/08/2026: SAC recolhe o produto do cliente sem entregar nada
// no lugar (ex.: devolução/cancelamento) -- diferente de troca_produto
// (recolhe E entrega) e de "recolhimento" (que é de PEÇA, não produto).
type SacType = "troca_produto" | "entrega_produto" | "envio_peca" | "recolhimento_produto" | "notificacao_externa";

// Tipos que envolvem entrega pelo motorista (produto/peça + quem vai levar).
// "O que recolher" só se aplica a troca_produto — os outros não têm
// recolhimento embutido no mesmo chamado (recolhimento_produto é só
// recolher, sem entregar nada -- já é auto-explicativo pelos itens listados).
const DELIVERY_TYPES: SacType[] = ["troca_produto", "entrega_produto", "envio_peca", "recolhimento_produto"];

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

// Hook local -- entrega e recolhimento (troca_produto) usam exatamente o
// mesmo estado e as mesmas 4 funções, só duas instâncias separadas (ver
// uso duplicado em SacCreateRequestForm abaixo). Pedido do Victor
// 26/08/2026: "obrigatorio colocar os produtos que deverão ser entregues e
// os produtos que deverão ser recolhidos" -- antes só existia essa lista
// (implicitamente "a entregar"), "o que recolher" era só texto livre
// opcional.
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
  const showProduct = isDelivery;
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

  // Rota/data já na criação -- pedido do Victor 17/08/2026: antes só dava
  // pra agendar depois, editando o chamado (ScheduleField). Mesma lógica de
  // lá (18/08/2026): a rota só pode ser uma das disponíveis pra data
  // escolhida -- busca de novo toda vez que a data muda, validado de novo no
  // servidor (createSacRequest espelha setSchedule), nunca confia só nisso
  // aqui.
  // Cidade primeiro, rota depois -- pedido do Victor 24/08/2026: "o
  // atendente escolher primeiro a cidade: João Pessoa ou Campina
  // Grande e depois as rotas".
  const [selectedCity, setSelectedCity] = useState<RotaCity>("joao_pessoa");
  // Id da atribuição (não só a rota) -- necessário desde que a rota
  // extra genérica de João Pessoa existe: duas extras do mesmo dia têm
  // o mesmo valor de `rota` ("extra"), só o `id` diferencia qual é
  // qual (mesmo motivo/solução de ScheduleField.tsx, pedido do Victor
  // 21/08/2026).
  const [selectedRotaId, setSelectedRotaId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  // Só valem enquanto isDelivery/scheduledDate se mantiverem verdadeiros --
  // ver hasDateContext abaixo, que mascara os dois quando a condição já não
  // bate mais. Mesmo desenho do getDayLoadAction em QuickCreateRequestForm.tsx:
  // setState só dentro do timer, nunca síncrono no corpo do efeito (regra do
  // React Compiler).
  const [availableRotas, setAvailableRotas] = useState<AvailableRota[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const hasDateContext = isDelivery && !!scheduledDate;

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
  // Motorista da rota escolhida -- pedido do Victor 18/08/2026: "quando eu
  // escolho a rota, ele ja deve preencher o motorista daquela rota". Só
  // preview aqui (setSchedule já grava isso sozinho ao salvar, ver
  // actions.ts); não dá pra digitar/trocar nesse campo.
  const previewDriverName = effectiveAvailableRotas.find((r) => r.id === selectedRotaId)?.driverName ?? null;
  const showAddressNumber = (ADDRESS_NUMBER_REQUIRED_TYPES as readonly string[]).includes(type);

  const { items, lookupStatus: itemsLookupStatus, update, add, remove, lookup } = useItemsList();
  // Só usada quando type === "troca_produto" (ver showProduct/isDelivery
  // abaixo) -- mas o hook precisa ser chamado sempre, sem condição.
  const {
    items: pickupItems,
    lookupStatus: pickupItemsLookupStatus,
    update: updatePickup,
    add: addPickup,
    remove: removePickup,
    lookup: lookupPickup,
  } = useItemsList();

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
            onChange={(e) => setType(e.target.value as SacType)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="troca_produto">{REQUEST_TYPE_LABELS.troca_produto} (recolher + entregar)</option>
            <option value="entrega_produto">{REQUEST_TYPE_LABELS.entrega_produto} (sem recolhimento)</option>
            <option value="envio_peca">{REQUEST_TYPE_LABELS.envio_peca}</option>
            <option value="recolhimento_produto">{REQUEST_TYPE_LABELS.recolhimento_produto} (sem entrega)</option>
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

      <FormSection
        title="Dados do cliente"
        number={2}
        hint="Digite o código do cliente pra preencher o resto automaticamente (se souber). CPF é sempre obrigatório."
      >
        <Field label="Código do cliente">
          <input
            name="client_protheus_code"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
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

      {showProduct ? (
        <FormSection
          title={type === "troca_produto" ? "Produtos a entregar" : "Produto(s) e entrega"}
          number={3}
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
            productLabel="Ex: Super Box Confort Mola Ensacada"
          />

          {/* "Troca com recolhimento" é o único tipo que recolhe de
              verdade (DRIVER_TYPE_LABELS.troca_produto) -- pedido do
              Victor 26/08/2026: lista própria e obrigatória, igual a de
              entrega, em vez de só o texto livre "O que recolher" lá
              embaixo (que virou só instrução extra, ver Detalhes). Server
              action (createSacRequest) exige pelo menos 1 item aqui
              também -- ItemsFields já bloqueia client-side (`required` no
              campo produto). */}
          {type === "troca_produto" ? (
            <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Produtos a recolher *
              </span>
              <ItemsFields
                items={pickupItems}
                lookupStatus={pickupItemsLookupStatus}
                onUpdate={updatePickup}
                onAdd={addPickup}
                onRemove={removePickup}
                onLookup={lookupPickup}
                namePrefix="pickup_item"
                productLabel="Ex: Super Box Confort Mola Ensacada (avariada)"
              />
            </div>
          ) : null}

          {isDelivery ? (
            <>
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
                <Field label="Hora (opcional)">
                  <input
                    name="scheduled_time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="rounded border px-3 py-2"
                    style={inputStyle}
                  />
                </Field>
                {/* Independente do checkbox "Urgente" acima (Seção 1) --
                    pedido do Victor 27/08/2026: "quando coloco que precisa
                    ser no periodo da tarde, ele nao me da a opção de
                    colocar como urgencia tambem". */}
                <Field label="Período (opcional)">
                  <select name="shift" defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
                    <option value="">Sem turno</option>
                    {SHIFTS.map((s) => (
                      <option key={s} value={s}>
                        {SHIFT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Cidade primeiro, rota depois -- pedido do Victor
                  24/08/2026. */}
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

              {/* Motorista não é mais um campo livre (pedido do Victor
                  18/08/2026) -- vem sempre da rota escolhida (preview logo
                  acima). Só continua digitável pra "erro do motorista", que
                  precisa registrar explicitamente quem entregou o item com
                  defeito. */}
              {causaRaiz === "erro_motorista" ? (
                <Field label="Motorista que entregou (erro) *">
                  <input
                    name="driver_name"
                    list="sac-drivers"
                    required
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
            </>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection title="Detalhes" number={4} hint="Conte o que aconteceu, com o máximo de detalhe que puder.">
        <Field label="Motivo *">
          <textarea name="reason" rows={2} required placeholder="Ex: produto entregue com avaria" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        {isDelivery ? (
          <Field label="Autorizado por *">
            <input
              name="authorized_by"
              required
              placeholder="Nome de quem autorizou (gerente, supervisor…)"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        ) : null}

        {isDelivery ? (
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
        ) : null}

        {isDelivery && causaRaiz === "erro_conferencia" ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              Erro de conferência -- precisa registrar qual carga e quem conferiu antes de seguir.
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

        {causaRaiz === "erro_motorista" ? (
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

        {/* "Outro" não tem campo próprio nenhum além do Motivo genérico lá
            em cima -- pedido do Victor 21/08/2026: "quando... selecionar
            'outro' ele precisar digitar o que houve exatamente". Mesmo
            padrão visual de erro_conferencia/erro_motorista acima, só que
            sem sub-campos estruturados (não tem carga/conferente pra
            "outro") -- um textarea dedicado, obrigatório. */}
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

        {type === "troca_produto" ? (
          // "O que recolher" virou lista de produtos própria e obrigatória
          // lá em cima (ver comentário na Seção 3) -- esse campo agora é
          // só complemento livre, opcional (ex.: onde deixar o produto
          // recolhido, algum cuidado especial).
          <Field label="Instrução extra pro motorista (opcional)">
            <textarea
              name="restriction_note"
              rows={2}
              placeholder="Ex: deixar a peça recolhida na expedição, cliente prefere receber à tarde"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        ) : null}

        {isDelivery ? (
          <Field label="Restrição de horário do cliente">
            <input
              name="client_time_restriction"
              placeholder="Ex: só de manhã, ou das 14h às 17h"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
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
        {pending ? "Criando…" : "Criar solicitação"}
      </button>
    </form>
  );
}
