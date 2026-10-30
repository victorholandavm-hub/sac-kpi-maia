"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { AvisoSaldoCd } from "./AvisoSaldoCd";
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
  PICKUP_DESTINATION_OPTIONS,
  PICKUP_DESTINATION_LABELS,
  CHECKLIST_REQUIRED_TYPES,
  SHIFT_LABELS,
  PRODUCT_CHECKLIST_LOCATION_LABELS,
} from "@/lib/assistenciaLabels";
import { ADDRESS_NUMBER_REQUIRED_TYPES, type Store } from "@/lib/serviceRequests";
import { CITY_LABELS, ROTA_CITY, ROTAS_BY_CITY, JP_EXTRA_ROTA, labelAvailableRota, type AvailableRota, type RotaCity } from "@/lib/rotas";
import { FormSection } from "./FormSection";
import { useFormDraft } from "./useFormDraft";
import { ConferenteField } from "./ConferenteField";
import { CONFERENTE_OUTRO_VALUE } from "@/lib/conferentes";
import { ChecklistEntregaFields } from "./ChecklistEntregaFields";
import { DeliveryTimeRestrictionField } from "./DeliveryTimeRestrictionField";
import { SummaryRow, ReviewWarningBanner } from "./ReviewSummary";

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

// "Pra onde vai o produto recolhido" -- pedido do Victor 30/09/2026, só pros
// 2 tipos que recolhem PRODUTO de verdade (envio_peca/entrega_produto não
// recolhem nada do cliente). Última pergunta do formulário, obrigatória --
// ver PICKUP_DESTINATION_OPTIONS em assistenciaLabels.ts.
const PICKUP_DESTINATION_TYPES: SacType[] = ["troca_produto", "recolhimento_produto"];

const ALL_SAC_TYPE_OPTIONS: { value: SacType; label: string }[] = [
  { value: "troca_produto", label: `${REQUEST_TYPE_LABELS.troca_produto} (recolher + entregar)` },
  { value: "entrega_produto", label: `${REQUEST_TYPE_LABELS.entrega_produto} (sem recolhimento)` },
  { value: "envio_peca", label: REQUEST_TYPE_LABELS.envio_peca },
  { value: "recolhimento_produto", label: `${REQUEST_TYPE_LABELS.recolhimento_produto} (sem entrega)` },
  { value: "notificacao_externa", label: "Notificação externa (sem troca de produto)" },
];

type Snapshot = {
  typeLabel: string;
  storeName: string;
  categoryLabel: string;
  urgent: boolean;
  invoiceFileName: string;
  clientCode: string;
  clientCpf: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientNeighborhood: string;
  addressNumber: string;
  addressComplement: string;
  reason: string;
  authorizedBy: string;
  causaRaizLabel: string;
  causaCarga: string;
  conferenteNome: string;
  driverNameErro: string;
  sellerName: string;
  causaRaizDetalhe: string;
  restrictionNote: string;
  timeRestrictionLabel: string;
  pickupDestinationLabel: string;
  scheduledDate: string;
  scheduledTime: string;
  cityLabel: string;
  rotaLabel: string;
  checklistLabel: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

// `partName` -- pedido do Victor 14/09/2026: "toda notificação de
// assistencia precisa estar ligada a no minimo um produto. Mesmo que seja
// o envio ou recolhimento de peça, tem que colocar o produto vinculado
// àquela peça". Só usada de verdade quando type === "envio_peca" (ver
// ItemsFields/showPart abaixo) -- nos outros tipos de entrega o "produto"
// já é o produto de verdade, sem peça associada.
type Item = { product: string; quantity: number; code: string; partName: string };
type ProductLookupStatus = "idle" | "loading" | "found" | "not_found";
const blankItem = (): Item => ({ product: "", quantity: 1, code: "", partName: "" });

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
  codeRequired,
  showPart,
  partLabel,
}: {
  items: Item[];
  lookupStatus: Record<number, ProductLookupStatus>;
  onUpdate: (index: number, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onLookup: (index: number, code: string) => void;
  namePrefix: string;
  productLabel: string;
  // Obrigatório só em troca_produto (ver uso abaixo) -- pedido do Victor
  // 10/09/2026: sem código, a assistência não entra na Taxa de Quebra/
  // Prejuízo do Relatório de Assistência (kpiAssistencia.ts cruza por
  // part_code). Troca é o tipo que mais alimenta esse relatório, por
  // isso é o único onde vira campo obrigatório de verdade -- nos outros
  // tipos fica só o aviso abaixo (não trava o envio).
  codeRequired?: boolean;
  // Campo "Peça" -- só envio_peca usa (ver showProduct/type no formulário
  // abaixo) -- pedido do Victor 14/09/2026.
  showPart?: boolean;
  partLabel?: string;
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
          {/* Peça vinculada ao produto -- pedido do Victor 14/09/2026: "na
              hora que colocasse o codigo do produto, aparecesse um novo
              campo da peça que será enviado e/ou recolhida, vinculando
              aquela peça ao produto". */}
          {showPart && item.code.trim() ? (
            <input
              name={`${namePrefix}_part_name`}
              value={item.partName}
              onChange={(e) => onUpdate(i, { partName: e.target.value })}
              required
              placeholder={partLabel}
              className="rounded border px-2 py-2"
              style={inputStyle}
            />
          ) : null}
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
          {/* Aviso de código em branco -- pedido do Victor 10/09/2026: sem
              part_code, o item fica de fora da Taxa de Quebra/Prejuízo do
              Relatório de Assistência (cruzamento por código, ver
              kpiAssistencia.ts). Não aparece junto com "não encontrado"
              acima (a busca já falhou, o aviso de campo vazio seria
              redundante) nem enquanto ainda tá buscando. */}
          {!item.code.trim() && lookupStatus[i] !== "loading" && lookupStatus[i] !== "not_found" ? (
            <p
              className="text-xs rounded px-2 py-1"
              style={{ background: "color-mix(in srgb, var(--status-warning) 18%, var(--surface-1))", color: "var(--status-warning)" }}
            >
              ⚠ Atenção: Sem o código do produto, esta assistência não contabilizará na taxa de quebra e nos custos do
              relatório.
            </p>
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
  allowedTypes,
}: {
  stores: Store[];
  drivers: string[];
  cargas: { carga: string; label: string }[];
  // Luis e Iasmyn (assistência) só podem criar os 3 tipos de
  // ASSISTENCIA_ALSO_MANAGED_TYPES -- pedido do Victor 25/09/2026, ver
  // sac/nova/page.tsx e ASSISTENCIA_CAN_CREATE_SAC_TYPES em
  // assistenciaLabels.ts. Sem essa prop (SAC/admin) mostra os 5 tipos de
  // sempre, sem mudança de comportamento.
  allowedTypes?: readonly SacType[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSacRequest, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const typeOptions = allowedTypes ? ALL_SAC_TYPE_OPTIONS.filter((o) => allowedTypes.includes(o.value)) : ALL_SAC_TYPE_OPTIONS;
  const [type, setType] = useState<SacType>(typeOptions[0]?.value ?? "troca_produto");
  const isDelivery = DELIVERY_TYPES.includes(type);
  const showProduct = isDelivery;
  const showPickupDestination = PICKUP_DESTINATION_TYPES.includes(type);
  const [pickupDestination, setPickupDestination] = useState("");
  // Só pra mostrar de qual loja se trata quando o destino é "loja" -- o
  // select de baixo (store_id, Seção 1) é a fonte de verdade de verdade,
  // esse estado só espelha a escolha pra confirmar na tela (pedido do
  // Victor: "quando for loja, tem que ser a loja que foi marcada lá em
  // cima, que é a loja do cliente" -- por isso não existe um 2º seletor de
  // loja aqui, só essa confirmação).
  const [storeId, setStoreId] = useState("");
  const selectedStoreName = stores.find((s) => s.id === storeId)?.name ?? null;
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
  const [clientLookupStatus, setClientLookupStatus] = useState<"idle" | "loading" | "found" | "found_partial" | "not_found">("idle");

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
  // "+ Novo motorista" -- pedido do Victor 22/10/2026: não precisa mais ir
  // em "Motorista do dia" cadastrar a rota extra antes de poder escolher um
  // motorista sem atribuição pro dia. Em João Pessoa a rota já é a extra
  // genérica (JP_EXTRA_ROTA); em Campina Grande (sem conceito de extra) o
  // atendente escolhe qual das 2 rotas fixas esse motorista novo vai cobrir.
  const NOVO_MOTORISTA_VALUE = "__novo__";
  const isNovoMotorista = selectedRotaId === NOVO_MOTORISTA_VALUE;
  const [novoMotoristaNome, setNovoMotoristaNome] = useState("");
  const [novoMotoristaRotaCg, setNovoMotoristaRotaCg] = useState(ROTAS_BY_CITY.campina_grande[0]);
  const [retiradaEm, setRetiradaEm] = useState<"" | "loja" | "cd">("");
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
        // CPF ficava faltando aqui -- achado do Victor 02/09/2026: "nenhum
        // cliente ou produto está aparecendo, quando colocamos o codigo
        // deles" (o campo CPF fica logo abaixo do código, então continuar
        // vazio dava a impressão de que nada tinha sido preenchido, mesmo
        // com nome/telefone/endereço funcionando normalmente).
        setClientCpf(match.cpfCnpj);
        if (match.phone1) setClientPhone(match.phone1);
        if (match.addressStreet) setClientAddress(match.addressStreet);
        if (match.addressNumber) setAddressNumber(match.addressNumber);
        if (match.addressComplement) {
          setIsApartment(true);
          setAddressComplement(match.addressComplement);
        }
        if (match.addressNeighborhood) setClientNeighborhood(match.addressNeighborhood);
        // Achado do Victor 04/09/2026 ("ainda nao está puxando automatico
        // os dados do cliente quando coloco o codigo dele"): pra maioria
        // dos códigos (24.584 já compraram, só 3.760 têm cadastro completo
        // sincronizado -- ver findTotvsClientByCode), o match só vem do
        // fallback totvs_orders, que não tem telefone/endereço nenhum. A
        // mensagem "Cliente encontrado" genérica escondia isso -- parecia
        // sucesso mas telefone/endereço/bairro (todos obrigatórios)
        // ficavam em branco sem explicação nenhuma. Agora avisa quando
        // faltou algo pra completar à mão.
        setClientLookupStatus(match.phone1 || match.addressStreet ? "found" : "found_partial");
      })
      .catch(() => setClientLookupStatus("not_found"));
  }

  // Mesma ideia de PublicRequestForm.tsx: código é só atalho, não trava nada
  // se não achar -- a pessoa preenche à mão como já era.
  useEffect(() => {
    const timer = setTimeout(() => runClientLookup(clientCode), 400);
    return () => clearTimeout(timer);
  }, [clientCode]);

  // Rascunho em localStorage -- pedido do Victor 15/09/2026, mesmo
  // racional de NovaEntregaAssistenciaForm.tsx (ver useFormDraft.ts). Nota
  // fiscal (invoice_file) nunca entra -- FormData não serializa arquivo
  // pra string, o hook já ignora sozinho (ver saveDraft lá).
  useFormDraft(formRef, "draft:sac-nova");

  // Monta o resumo a partir do FormData de verdade (cobre também os campos
  // não controlados -- restrição de horário, checklist) -- mesma técnica
  // de PublicRequestForm.tsx:handleRevisar. Pedido do Victor 24/10/2026:
  // revisão explícita antes de enviar, pra evitar erro de preenchimento.
  function handleRevisar() {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const str = (name: string) => String(fd.get(name) ?? "").trim();
    const invoiceFile = fd.get("invoice_file");
    const conferenteChoice = str("causa_conferente");
    const conferenteNome = conferenteChoice === CONFERENTE_OUTRO_VALUE ? str("causa_conferente_other") : conferenteChoice;

    const timeMode = str("time_restriction_mode");
    const timeRestrictionLabel =
      timeMode === "turno"
        ? `Turno: ${SHIFT_LABELS[str("time_restriction_shift") as keyof typeof SHIFT_LABELS] ?? str("time_restriction_shift")}`
        : timeMode === "hora"
          ? `Das ${str("time_restriction_from")} às ${str("time_restriction_to")}`
          : timeMode === "sem_restricao"
            ? "Sem restrição"
            : "";

    const checklistParts: string[] = [];
    if (fd.get("checklist_estoque")) checklistParts.push("Em estoque");
    if (fd.get("checklist_separado")) checklistParts.push("Separado");
    if (fd.get("checklist_placa")) checklistParts.push("Sinalizado com placa");
    const localizacao = str("checklist_localizacao");
    if (localizacao) checklistParts.push(PRODUCT_CHECKLIST_LOCATION_LABELS[localizacao as keyof typeof PRODUCT_CHECKLIST_LOCATION_LABELS] ?? localizacao);

    setSnapshot({
      typeLabel: typeOptions.find((o) => o.value === type)?.label ?? type,
      storeName: selectedStoreName ?? "",
      categoryLabel: type === "notificacao_externa" ? (SAC_CATEGORY_LABELS[str("sac_category") as keyof typeof SAC_CATEGORY_LABELS] ?? "") : "",
      urgent: !!fd.get("urgent"),
      invoiceFileName: invoiceFile instanceof File && invoiceFile.size > 0 ? invoiceFile.name : "",
      clientCode,
      clientCpf,
      clientName,
      clientPhone,
      clientAddress,
      clientNeighborhood,
      addressNumber,
      addressComplement: isApartment ? addressComplement : "",
      reason: str("reason"),
      authorizedBy: str("authorized_by"),
      causaRaizLabel: causaRaiz ? (CAUSA_RAIZ_LABELS[causaRaiz] ?? causaRaiz) : "",
      causaCarga: str("causa_carga"),
      conferenteNome,
      driverNameErro: causaRaiz === "erro_motorista" ? str("driver_name") : "",
      sellerName: str("seller_name"),
      causaRaizDetalhe: str("causa_raiz_detalhe"),
      restrictionNote: str("restriction_note"),
      timeRestrictionLabel,
      pickupDestinationLabel: pickupDestination ? (PICKUP_DESTINATION_LABELS[pickupDestination as keyof typeof PICKUP_DESTINATION_LABELS] ?? pickupDestination) : "",
      scheduledDate,
      scheduledTime,
      cityLabel: isDelivery && scheduledDate ? CITY_LABELS[selectedCity] : "",
      rotaLabel: isNovoMotorista
        ? `+ Novo motorista: ${novoMotoristaNome || "(nome não preenchido)"} — ${selectedCity === "campina_grande" ? novoMotoristaRotaCg : "rota extra JP"}`
        : (() => {
            const found = effectiveAvailableRotas.find((r) => r.id === selectedRotaId);
            return found ? `${labelAvailableRota(effectiveAvailableRotas, found)}${previewDriverName ? ` — motorista ${previewDriverName}` : ""}` : "";
          })(),
      checklistLabel: checklistParts.join(" · "),
    });
    setReviewing(true);
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 max-w-xl">
      <div style={{ display: reviewing ? "none" : undefined }} className="flex flex-col gap-4">
      <FormSection title="Tipo e loja" number={1}>
        <Field label="Tipo">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as SacType)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

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

        {/* Nota fiscal obrigatória só pra Entregas -- correção do Victor
            10/09/2026: "as unicas abas que precisam são as solicitações
            feitas pelo sac na aba de entregas e as solicitações de
            encomenda... montagem/desmontagem nao precisa" (revisão do
            pedido original de 09/09/2026, que era "todo tipo" -- montagem
            nem passa por este formulário, mas notificação externa passa e
            também não é "entrega", então também sai da exigência). Sobe
            junto com o resto do formulário (sem endpoint de upload
            separado, ver createSacRequest em actions.ts) e sai impressa
            junto com a notificação no despacho (DespachoCard.tsx), pra não
            misturar a nota errada com o cliente errado ao imprimir várias
            de uma vez. */}
        {isDelivery ? (
          <Field label="Nota fiscal * (PDF)">
            {/* Só PDF -- pedido do Victor 11/09/2026: "para o sac, você so
                deve permitir que seja anexado pdf, imagem não pode" (foto
                de tela/celular vinha ilegível demais pra servir de
                comprovante fiscal de verdade). `accept` só filtra o que
                aparece no seletor de arquivo do navegador (UX, contorna
                fácil) -- a validação de verdade é no servidor
                (createSacRequest, actions.ts). */}
            <input
              name="invoice_file"
              type="file"
              required
              accept="application/pdf"
              className="rounded border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </Field>
        ) : null}
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
          ) : clientLookupStatus === "found_partial" ? (
            <span className="text-xs" style={{ color: "var(--status-warning)" }}>
              Cliente encontrado, mas sem telefone/endereço no cadastro — preencha esses campos à mão.
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
          title={
            type === "troca_produto"
              ? "Produtos a entregar"
              : // recolhimento_produto não entrega nada, só recolhe --
                // achado do Victor 29/08/2026: o título "Produto(s) e
                // entrega" ficava errado nesse tipo (o motorista vai só
                // buscar o produto na casa do cliente, sem levar nada no
                // lugar).
                type === "recolhimento_produto"
                ? "Produto(s) a recolher"
                : // envio_peca tem produto E peça agora -- pedido do Victor
                  // 14/09/2026.
                  type === "envio_peca"
                  ? "Produto e peça a enviar"
                  : "Produto(s) e entrega"
          }
          number={3}
          hint={
            type === "envio_peca"
              ? "Digite o código do produto pra preencher o nome automaticamente (se souber) -- depois informe a peça específica dele."
              : "Digite o código do produto pra preencher o nome automaticamente (se souber)."
          }
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
            codeRequired={type === "troca_produto"}
            showPart={type === "envio_peca"}
            partLabel="Ex: Puxador de roupeiro"
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
                codeRequired
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

              <Field label="Retirada">
                <select
                  name="retirada_em"
                  value={retiradaEm}
                  onChange={(e) => setRetiradaEm(e.target.value as "" | "loja" | "cd")}
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                >
                  <option value="">Sai em rota</option>
                  <option value="loja">Cliente retira na loja</option>
                  <option value="cd">Cliente retira no CD</option>
                </select>
              </Field>

              {/* Rota continua escolhível mesmo com retirada em loja/CD --
                  ver mesmo comentário em NovaEntregaAssistenciaForm.tsx. */}
              <Field label="Rota">
                <select
                  name={isNovoMotorista ? undefined : "rotaAssignmentId"}
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
                  <option value={NOVO_MOTORISTA_VALUE}>+ Novo motorista (cria rota extra)</option>
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
              ) : isNovoMotorista ? null : effectiveAvailableRotas.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--status-warning)" }}>
                  Nenhuma rota de {CITY_LABELS[selectedCity]} disponível pra essa data.
                </p>
              ) : selectedRotaId ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Motorista: {previewDriverName ?? "nenhum escolhido ainda"}
                </p>
              ) : null}

              {/* Motorista sem rota extra cadastrada ainda -- pedido do
                  Victor 22/10/2026: cria a rota extra junto com o chamado,
                  sem precisar ir em "Motorista do dia" antes. */}
              {isNovoMotorista ? (
                <>
                  <Field label="Nome do motorista *">
                    <input
                      name="novo_motorista_nome"
                      list="sac-drivers"
                      required={isNovoMotorista}
                      value={novoMotoristaNome}
                      onChange={(e) => setNovoMotoristaNome(e.target.value)}
                      className="rounded border px-3 py-2"
                      style={inputStyle}
                    />
                  </Field>
                  {selectedCity === "campina_grande" ? (
                    <Field label="Qual rota de Campina Grande?">
                      <select
                        name="novo_motorista_rota"
                        value={novoMotoristaRotaCg}
                        onChange={(e) => setNovoMotoristaRotaCg(e.target.value as (typeof ROTAS_BY_CITY)["campina_grande"][number])}
                        className="rounded border px-3 py-2"
                        style={inputStyle}
                      >
                        {ROTAS_BY_CITY.campina_grande.map((r) => (
                          <option key={r} value={r}>
                            {labelAvailableRota([], { id: r, rota: r })}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <input type="hidden" name="novo_motorista_rota" value={JP_EXTRA_ROTA} />
                  )}
                </>
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

        {isDelivery && (causaRaiz === "erro_conferencia" || causaRaiz === "sujeira_conferencia") ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--status-critical)" }}>
            <p className="text-xs font-medium" style={{ color: "var(--status-critical)" }}>
              {causaRaiz === "sujeira_conferencia"
                ? "Sujeira não barrada na conferência -- precisa registrar qual carga e quem conferiu antes de seguir."
                : "Erro de conferência -- precisa registrar qual carga e quem conferiu antes de seguir."}
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
            <ConferenteField inputStyle={inputStyle} />
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

        {isDelivery ? <DeliveryTimeRestrictionField /> : null}

        {/* Última pergunta, obrigatória -- pedido do Victor 30/09/2026: "o
            produto recolhido irá para onde: Estoque CD, Avaria CD, LOJA".
            Só troca_produto/recolhimento_produto recolhem PRODUTO de
            verdade do cliente (ver PICKUP_DESTINATION_TYPES acima) -- os
            outros tipos de entrega não têm recolhimento nenhum pra ter
            destino. Quando é "loja", é sempre a loja já escolhida na
            Seção 1 (client_protheus_code/store_id) -- não existe um 2º
            seletor de loja aqui de propósito, só a confirmação abaixo. */}
        {showPickupDestination ? (
          <Field label="O produto recolhido irá para onde? *">
            <select
              name="pickup_destination"
              required
              value={pickupDestination}
              onChange={(e) => setPickupDestination(e.target.value)}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {PICKUP_DESTINATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {PICKUP_DESTINATION_LABELS[d]}
                </option>
              ))}
            </select>
            {pickupDestination === "loja" ? (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selectedStoreName ? `Vai pra ${selectedStoreName} (a loja do cliente, escolhida lá em cima).` : "Escolha a loja lá em cima (Seção 1) primeiro."}
              </span>
            ) : null}
          </Field>
        ) : null}

      </FormSection>

      {/* Checklist antes de finalizar (0181) -- pedido do Victor 17/10/2026,
          só pros 3 tipos de CHECKLIST_REQUIRED_TYPES (troca_produto/
          entrega_produto/envio_peca). Não bloqueia o "Criar" -- incompleto
          vira rascunho, sem entrar na rota (ver ChecklistEntregaFields.tsx). */}
      {(CHECKLIST_REQUIRED_TYPES as readonly string[]).includes(type) ? (
        <FormSection title="Checklist antes de finalizar" number={5}>
          <ChecklistEntregaFields />
        </FormSection>
      ) : null}

      <button
        type="button"
        onClick={handleRevisar}
        className="rounded px-4 py-2 font-medium self-start"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Revisar solicitação
      </button>
      </div>

      {reviewing && snapshot ? (
        <FormSection title="Confira antes de enviar" hint="Se algo estiver errado, volte e corrija.">
          <ReviewWarningBanner />
          <div className="flex flex-col gap-3 mt-3">
            <SummaryRow label="Tipo" value={snapshot.typeLabel} />
            <SummaryRow label="Loja" value={snapshot.storeName} />
            <SummaryRow label="Categoria" value={snapshot.categoryLabel} />
            <SummaryRow label="Urgente" value={snapshot.urgent ? "Sim" : ""} />
            <SummaryRow label="Nota fiscal anexada" value={snapshot.invoiceFileName} />
            <SummaryRow label="Cliente" value={snapshot.clientName} />
            <SummaryRow label="CPF" value={snapshot.clientCpf} />
            <SummaryRow label="Telefone" value={snapshot.clientPhone} />
            <SummaryRow
              label="Endereço"
              value={[
                [snapshot.clientAddress, snapshot.addressNumber ? `nº ${snapshot.addressNumber}` : null].filter(Boolean).join(", "),
                snapshot.addressComplement ? `apto ${snapshot.addressComplement}` : null,
                snapshot.clientNeighborhood,
              ]
                .filter(Boolean)
                .join(" — ")}
            />
            {items.filter((i) => i.product.trim()).length > 0 ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {type === "recolhimento_produto" ? "Produto(s) a recolher" : "Produto(s)"}
                </span>
                <ul className="text-sm flex flex-col gap-0.5" style={{ color: "var(--text-primary)" }}>
                  {items
                    .filter((i) => i.product.trim())
                    .map((i, idx) => (
                      <li key={idx}>
                        {i.quantity}x {i.product}
                        {i.code ? ` (${i.code})` : ""}
                        {i.partName ? ` — peça: ${i.partName}` : ""}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            {type === "troca_produto" && pickupItems.filter((i) => i.product.trim()).length > 0 ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Produtos a recolher
                </span>
                <ul className="text-sm flex flex-col gap-0.5" style={{ color: "var(--text-primary)" }}>
                  {pickupItems
                    .filter((i) => i.product.trim())
                    .map((i, idx) => (
                      <li key={idx}>
                        {i.quantity}x {i.product}
                        {i.code ? ` (${i.code})` : ""}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <SummaryRow label="Data agendada" value={snapshot.scheduledDate ? snapshot.scheduledDate.split("-").reverse().join("/") : ""} />
            <SummaryRow label="Hora" value={snapshot.scheduledTime} />
            <SummaryRow label="Cidade" value={snapshot.cityLabel} />
            <SummaryRow label="Rota" value={snapshot.rotaLabel} />
            <SummaryRow label="Pra onde vai o produto recolhido" value={snapshot.pickupDestinationLabel} />
            <SummaryRow label="Restrição de horário" value={snapshot.timeRestrictionLabel} />
            <SummaryRow label="Motivo" value={snapshot.reason} />
            <SummaryRow label="Autorizado por" value={snapshot.authorizedBy} />
            <SummaryRow label="Quem errou (controle interno)" value={snapshot.causaRaizLabel} />
            <SummaryRow label="Carga" value={snapshot.causaCarga} />
            <SummaryRow label="Conferente" value={snapshot.conferenteNome} />
            <SummaryRow label="Motorista que entregou (erro)" value={snapshot.driverNameErro} />
            <SummaryRow label="Vendedor(a)" value={snapshot.sellerName} />
            <SummaryRow label="Causa raiz detalhada" value={snapshot.causaRaizDetalhe} />
            <SummaryRow label="Instrução extra pro motorista" value={snapshot.restrictionNote} />
            <SummaryRow label="Checklist" value={snapshot.checklistLabel} />
          </div>

          {type === "troca_produto" || type === "entrega_produto" ? (
            <div className="mt-3">
              <AvisoSaldoCd itens={items.map((i) => ({ codigo: i.code, qtd: i.quantity }))} />
            </div>
          ) : null}

          {state?.error ? (
            <p className="text-sm mt-3" style={{ color: "var(--status-critical)" }}>
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded px-4 py-2 font-medium disabled:opacity-60"
              style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
            >
              {pending ? "Criando…" : "Confirmar e enviar"}
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
