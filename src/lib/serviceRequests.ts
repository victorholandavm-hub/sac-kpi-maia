import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";
import type { Rota } from "./rotas";
import { ASSISTENCIA_MANAGED_TYPES, DELIVERY_REQUEST_TYPES, OWN_ASSEMBLER_RESTRICTED_TYPES, VISITA_REQUEST_TYPES } from "./assistenciaLabels";

export type RequestType =
  | "montagem"
  | "desmontagem"
  | "recolhimento"
  | "troca_peca"
  | "vistoria"
  | "notificacao_externa"
  | "troca_produto"
  | "entrega_produto"
  | "envio_peca"
  | "recolhimento_produto";
export type RequestStatus = "aberta" | "em_contato" | "em_andamento" | "remarcar" | "concluida" | "cancelada";
export type DeadlineStatus = "pendente" | "aprovado" | "recusado";
export type Shift = "manha" | "tarde" | "dia" | "urgencia";

export const REQUEST_STATUSES: RequestStatus[] = [
  "aberta",
  "em_contato",
  "em_andamento",
  "remarcar",
  "concluida",
  "cancelada",
];

export const SHIFTS: Shift[] = ["manha", "tarde", "dia", "urgencia"];

export function isShift(value: string | undefined | null): value is Shift {
  return !!value && (SHIFTS as string[]).includes(value);
}

// Chamado de "Mostruário" -- a loja monta/desmonta um item de exposição
// própria, sem cliente real (client_name vira "Mostruário — <Loja>",
// endereço/telefone ficam null por design). Mesmo critério usado em
// EditServiceRequestForm.tsx/PublicRequestForm.tsx, centralizado aqui pra
// não duplicar (ver montador-actions.ts/loja/page.tsx, que também
// precisam disso pra pular a avaliação do "cliente").
export function isMostruarioRequest(orderCode: string | null | undefined, clientName: string | null | undefined): boolean {
  return !orderCode && (clientName ?? "").startsWith("Mostruário — ");
}

export function isRequestStatus(value: string | undefined | null): value is RequestStatus {
  return !!value && (REQUEST_STATUSES as string[]).includes(value);
}

// Todo tipo com visita/entrega de verdade (montador ou motorista indo até o
// endereço) exige número -- e apto/bloco, quando for prédio -- separado do
// resto do endereço em texto livre. Sem isso, casos reais já aconteceram de
// faltar o bloco/apto e o montador/motorista chegar no endereço sem saber
// onde tocar a campainha. Só "notificacao_externa" fica de fora (SAC,
// nunca envolve visita física). Antes só cobria montagem/desmontagem --
// recolhimento/troca de peça/vistoria (montador) e troca/entrega de
// produto/envio de peça (motorista) tinham a mesma lacuna.
export const ADDRESS_NUMBER_REQUIRED_TYPES: RequestType[] = [
  "montagem",
  "desmontagem",
  "recolhimento",
  "troca_peca",
  "vistoria",
  "troca_produto",
  "entrega_produto",
  "envio_peca",
  "recolhimento_produto",
];

// Usado em toda tela que exibe o endereço (detalhe do chamado, montador,
// motorista) — mantém rua/número/apto num único texto formatado em vez de
// cada tela remontar essa lógica na mão.
export function formatFullAddress(input: {
  clientAddress: string | null;
  clientAddressNumber?: string | null;
  clientIsApartment?: boolean;
  clientAddressComplement?: string | null;
}): string | null {
  if (!input.clientAddress) return null;
  let line = input.clientAddressNumber ? `${input.clientAddress}, nº ${input.clientAddressNumber}` : input.clientAddress;
  if (input.clientIsApartment && input.clientAddressComplement) {
    line += ` — apto ${input.clientAddressComplement}`;
  }
  return line;
}

export type Store = { id: string; name: string };

export async function listStores(): Promise<Store[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("stores").select("id, name").order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ItemAction = "montar" | "desmontar";

export type RequestItem = {
  id: string;
  product: string;
  partCode: string | null;
  quantity: number;
  unitValue: number | null;
  paymentReleased: boolean;
  paymentReleasedAt: string | null;
  paymentAuthorizedBy: string | null;
  action: ItemAction | null;
  completed: boolean;
};

type ItemRow = {
  id: string;
  product: string;
  part_code: string | null;
  quantity: number;
  unit_value: number | null;
  payment_released: boolean;
  payment_released_at: string | null;
  payment_authorized_by: string | null;
  item_action: string | null;
  completed: boolean;
};

export type ServiceRequestSummary = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  status: RequestStatus;
  storeId: string;
  storeName: string;
  orderCode: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientNeighborhood: string | null;
  items: RequestItem[];
  reason: string | null;
  requestedByName: string | null;
  requestedDeadline: string | null;
  deadlineStatus: DeadlineStatus;
  approvedDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assemblerName: string | null;
  driverName: string | null;
  pickupCompleted: boolean;
  scheduledDate: string | null;
  scheduledTime: string | null;
  shift: Shift | null;
  rota: Rota | null;
  rotaExceptionNote: string | null;
  // Restrição de horário/turno do CLIENTE pra receber a entrega (ex.: "só de
  // manhã", "14h às 17h") -- pedido do Victor 19/08/2026. Separado de
  // restrictionNote/montadorInstruction, que são instrução pro
  // motorista/montador, não limitação do cliente.
  clientTimeRestriction: string | null;
  sellerName: string | null;
  invoiceNumber: string | null;
  sacCategory: string | null;
  protocolNumber: string | null;
  legalDeadline: string | null;
  escalationRisk: boolean;
  comboMontagemDesmontagem: boolean;
  assistenciaOrder: number | null;
  montadorInstruction: string | null;
  // Só relevante pra troca_produto (ver createExchangeChild em actions.ts)
  // -- 1 na 1ª troca, N na posição N da cadeia (chamado próprio pra cada
  // rodada desde 18/08/2026, ligados por parentExchange/childExchange em
  // ServiceRequestDetail).
  exchangeRound: number;
  // Causa raiz da troca (troca_produto) -- ver CAUSA_RAIZ_LABELS. Quando
  // "erro_conferencia", causaCarga/causaConferente são preenchimento
  // obrigatório na criação; quando "erro_motorista", causaCarga + o
  // driverName do chamado; quando "outro", causaRaizDetalhe (ver
  // createSacRequest/createQuickRequest/createExchangeChild).
  causaRaiz: string | null;
  causaCarga: string | null;
  causaConferente: string | null;
  causaRaizDetalhe: string | null;
};

type SummaryRow = {
  id: string;
  ticket_number: number;
  type: RequestType;
  status: RequestStatus;
  store_id: string;
  order_code: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_neighborhood: string | null;
  reason: string | null;
  requested_by_name: string | null;
  requested_deadline: string | null;
  deadline_status: DeadlineStatus;
  approved_deadline: string | null;
  assembler_name: string | null;
  driver_name: string | null;
  pickup_completed: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  shift: Shift | null;
  rota: Rota | null;
  rota_exception_note: string | null;
  client_time_restriction: string | null;
  seller_name: string | null;
  invoice_number: string | null;
  sac_category: string | null;
  protocol_number: string | null;
  legal_deadline: string | null;
  escalation_risk: boolean;
  combo_montagem_desmontagem: boolean;
  assistencia_order: number | null;
  montador_instruction: string | null;
  exchange_round: number;
  causa_raiz: string | null;
  causa_carga: string | null;
  causa_conferente: string | null;
  causa_raiz_detalhe: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assigned_to: string | null;
  stores: { name: string } | null;
  assigned: { full_name: string } | null;
  requester: { full_name: string } | null;
  items: ItemRow[] | null;
};

const SUMMARY_COLUMNS =
  "id, ticket_number, type, status, store_id, order_code, client_name, client_phone, client_neighborhood, reason, requested_by_name, requested_deadline, deadline_status, approved_deadline, assembler_name, driver_name, pickup_completed, scheduled_date, scheduled_time, shift, rota, rota_exception_note, client_time_restriction, seller_name, invoice_number, sac_category, protocol_number, legal_deadline, escalation_risk, combo_montagem_desmontagem, assistencia_order, montador_instruction, exchange_round, causa_raiz, causa_carga, causa_conferente, causa_raiz_detalhe, created_at, updated_at, completed_at, assigned_to, stores(name), assigned:profiles!assigned_to(full_name), requester:profiles!requested_by(full_name), items:service_request_items(id, product, part_code, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, item_action, completed)";

function toItem(row: ItemRow): RequestItem {
  return {
    id: row.id,
    product: row.product,
    partCode: row.part_code,
    quantity: row.quantity,
    unitValue: row.unit_value,
    paymentReleased: row.payment_released,
    paymentReleasedAt: row.payment_released_at,
    paymentAuthorizedBy: row.payment_authorized_by,
    action: row.item_action === "montar" || row.item_action === "desmontar" ? row.item_action : null,
    completed: row.completed,
  };
}

function toSummary(row: SummaryRow): ServiceRequestSummary {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    type: row.type,
    status: row.status,
    storeId: row.store_id,
    storeName: row.stores?.name ?? row.store_id,
    orderCode: row.order_code,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientNeighborhood: row.client_neighborhood,
    items: (row.items ?? []).map(toItem),
    reason: row.reason,
    requestedByName: row.requester?.full_name ?? row.requested_by_name ?? null,
    requestedDeadline: row.requested_deadline,
    deadlineStatus: row.deadline_status,
    approvedDeadline: row.approved_deadline,
    assemblerName: row.assembler_name,
    driverName: row.driver_name,
    pickupCompleted: row.pickup_completed,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    shift: row.shift,
    rota: row.rota,
    rotaExceptionNote: row.rota_exception_note,
    clientTimeRestriction: row.client_time_restriction,
    sellerName: row.seller_name,
    invoiceNumber: row.invoice_number,
    sacCategory: row.sac_category,
    protocolNumber: row.protocol_number,
    legalDeadline: row.legal_deadline,
    escalationRisk: row.escalation_risk,
    comboMontagemDesmontagem: row.combo_montagem_desmontagem,
    assistenciaOrder: row.assistencia_order,
    montadorInstruction: row.montador_instruction,
    exchangeRound: row.exchange_round,
    causaRaiz: row.causa_raiz,
    causaCarga: row.causa_carga,
    causaConferente: row.causa_conferente,
    causaRaizDetalhe: row.causa_raiz_detalhe,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    assignedToId: row.assigned_to,
    assignedToName: row.assigned?.full_name ?? null,
  };
}

// Alguns chamados de montagem/desmontagem/vistoria são de lojas com
// montador próprio (ver OWN_ASSEMBLER_STORE_IDS em assistenciaLabels.ts) e
// não devem aparecer pra quem não tem visibilidade sobre elas (ver
// canSeeOwnAssemblerStoreRequests em dal.ts). `excludeStoreIds` é a lista
// de lojas restritas que ESSE chamador específico não pode ver -- pode ser
// as duas, uma só (o gerente da outra, olhando "todas as lojas"), ou
// nenhuma (admin/Antonio) -- ver fila/page.tsx e loja/page.tsx. Só afasta a
// linha se ela for das duas coisas ao mesmo tempo (loja restrita E tipo
// restrito) -- recolhimento/troca de peça/envio de peça dessas lojas
// continuam visíveis normalmente, são atendimento central de qualquer jeito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOwnAssemblerStoreExclusion(query: any, excludeStoreIds: string[] | undefined) {
  if (!excludeStoreIds || excludeStoreIds.length === 0) return query;
  return query.or(`store_id.not.in.(${excludeStoreIds.join(",")}),type.not.in.(${OWN_ASSEMBLER_RESTRICTED_TYPES.join(",")})`);
}

export const REQUESTS_PAGE_SIZE = 100;

export type ListRequestsResult = {
  items: ServiceRequestSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listRequests(
  opts: {
    status?: RequestStatus;
    q?: string;
    page?: number;
    storeId?: string;
    assemblerName?: string;
    types?: RequestType[];
    // YYYY-MM-DD, valida antes de interpolar (mesmo padrão de listDayLoad) --
    // filtra por created_at, sempre no fuso de João Pessoa (ver formatDateTime.ts).
    dateFrom?: string;
    dateTo?: string;
    // Ver applyOwnAssemblerStoreExclusion acima.
    excludeOwnAssemblerStoreIds?: string[];
  } = {}
): Promise<ListRequestsResult> {
  const admin = getSupabaseAdmin();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = REQUESTS_PAGE_SIZE;

  // Tipado como `any` de propósito (ver listScheduledRequests): encadear vários
  // filtros condicionais faz o TypeScript travar tentando inferir um tipo
  // genérico profundo demais.
  // Só created_at aqui -- assistencia_order NÃO entra no sort global: ele é
  // reatribuído (1, 2, 3…) toda vez que a assistência reordena um grupo do
  // dia na fila (ver setAssistenciaOrderAction), então o mesmo valor pequeno
  // se repete em dias diferentes. Usar isso como critério global de ordenação
  // fazia chamado antigo de um dia qualquer que já foi reordenado pular pra
  // frente de chamados muito mais novos (inclusive furando a paginação, já
  // que a página 1 é definida por esse sort). A ordem manual continua
  // valendo, mas só dentro de cada grupo do dia, calculada em JS na página da
  // fila (ver groupByDate em fila/page.tsx) -- é o único lugar que expõe
  // reordenar mesmo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin
    .from("service_requests")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.storeId) {
    query = query.eq("store_id", opts.storeId);
  }
  if (opts.status) {
    query = query.eq("status", opts.status);
  }
  if (opts.assemblerName) {
    query = query.eq("assembler_name", opts.assemblerName);
  }
  if (opts.types && opts.types.length > 0) {
    query = query.in("type", opts.types);
  }
  if (opts.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(opts.dateFrom)) {
    query = query.gte("created_at", `${opts.dateFrom}T00:00:00-03:00`);
  }
  if (opts.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(opts.dateTo)) {
    query = query.lte("created_at", `${opts.dateTo}T23:59:59-03:00`);
  }
  query = applyOwnAssemblerStoreExclusion(query, opts.excludeOwnAssemblerStoreIds);

  const q = opts.q?.trim();
  if (q) {
    const { data: itemMatches } = await admin.from("service_request_items").select("request_id").ilike("product", `%${q}%`);
    const matchingIds = [...new Set((itemMatches ?? []).map((r) => r.request_id as string))];

    const qSafe = sanitizeOrFilterValue(q);
    const orParts = [
      `client_name.ilike.%${qSafe}%`,
      `client_cpf.ilike.%${qSafe}%`,
      `client_phone.ilike.%${qSafe}%`,
      `order_code.ilike.%${qSafe}%`,
    ];
    if (matchingIds.length > 0) {
      orParts.push(`id.in.(${matchingIds.join(",")})`);
    }
    const ticketNumberMatch = /^#?(\d+)$/.exec(q);
    if (ticketNumberMatch) {
      orParts.push(`ticket_number.eq.${ticketNumberMatch[1]}`);
    }
    query = query.or(orParts.join(","));
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = (await query) as {
    data: SummaryRow[] | null;
    error: { message: string } | null;
    count: number | null;
  };
  if (error) throw new Error(error.message);

  return {
    items: ((data ?? []) as unknown as SummaryRow[]).map(toSummary),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export type ServiceRequestDetail = ServiceRequestSummary & {
  clientCpf: string | null;
  clientAddress: string | null;
  clientAddressNumber: string | null;
  clientIsApartment: boolean;
  clientAddressComplement: string | null;
  clientNeighborhood: string | null;
  restrictionNote: string | null;
  notes: string | null;
  deliveryRating: number | null;
  resolutionRating: number | null;
  // Quem autorizou a troca/entrega/envio -- texto livre, digitado por quem
  // cria o chamado (não é o requestedByName, que é quem criou o chamado no
  // sistema, ver serviceRequests.ts). Só relevante pra DELIVERY_REQUEST_TYPES.
  authorizedBy: string | null;
  // Cadeia de trocas ligadas (ver createExchangeChild em actions.ts e
  // 0090_exchange_parent_request.sql) -- parentExchange é a troca de onde
  // esse chamado nasceu (null se for a 1ª troca); childExchange é a próxima
  // rodada, se já foi criada (só existe um filho por chamado -- uma vez que
  // existe, o botão "Nova troca" some daqui e passa a valer no filho).
  parentExchange: LinkedExchangeRef | null;
  childExchange: LinkedExchangeRef | null;
};

export type LinkedExchangeRef = { id: string; ticketNumber: number; status: RequestStatus };

export type RequestEvent = {
  id: string;
  eventType:
    | "created"
    | "status_changed"
    | "assigned"
    | "note_added"
    | "deadline_approved"
    | "deadline_rejected"
    | "edited"
    | "printed";
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  actorName: string | null;
};

type DetailRow = SummaryRow & {
  client_cpf: string | null;
  client_address: string | null;
  client_address_number: string | null;
  client_is_apartment: boolean;
  client_address_complement: string | null;
  client_neighborhood: string | null;
  restriction_note: string | null;
  notes: string | null;
  delivery_rating: number | null;
  resolution_rating: number | null;
  authorized_by: string | null;
  parent_request_id: string | null;
};

type EventRow = {
  id: string;
  event_type: RequestEvent["eventType"];
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
  actor: { full_name: string } | null;
};

const DETAIL_COLUMNS =
  // rota/rota_exception_note faltavam aqui (bug real, achado 18/08/2026) --
  // SUMMARY_COLUMNS (fila) sempre teve, mas essa lista (chamado, editar,
  // despacho) nunca selecionava as duas colunas: request.rota vinha sempre
  // undefined nessas telas, mesmo com a rota gravada certinha no banco --
  // é provavelmente a causa raiz de verdade do "Sem rota" que aparecia na
  // tela do chamado (mais fundamental que o bug de ScheduleField.tsx
  // corrigido antes hoje, que só evitava apagar a rota ao SALVAR).
  "id, ticket_number, type, status, store_id, order_code, client_name, client_phone, client_cpf, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, reason, authorized_by, restriction_note, notes, montador_instruction, requested_by_name, requested_deadline, deadline_status, approved_deadline, assembler_name, driver_name, pickup_completed, delivery_rating, resolution_rating, scheduled_date, scheduled_time, shift, rota, rota_exception_note, client_time_restriction, seller_name, invoice_number, sac_category, protocol_number, legal_deadline, escalation_risk, combo_montagem_desmontagem, exchange_round, causa_raiz, causa_carga, causa_conferente, parent_request_id, created_at, updated_at, completed_at, assigned_to, stores(name), requester:profiles!requested_by(full_name), assigned:profiles!assigned_to(full_name), items:service_request_items(id, product, part_code, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, item_action, completed)";

export async function getRequestDetail(
  id: string
): Promise<{ request: ServiceRequestDetail; events: RequestEvent[] } | null> {
  const admin = getSupabaseAdmin();
  // As duas consultas principais são independentes (nenhuma depende do
  // resultado da outra) -- rodar em paralelo em vez de uma atrás da outra
  // economiza uma ida e volta ao banco, e essa função é chamada por 4 telas
  // diferentes (chamado, editar, despacho, editar da loja).
  const [{ data, error }, { data: eventRows }] = await Promise.all([
    admin.from("service_requests").select(DETAIL_COLUMNS).eq("id", id).single(),
    admin
      .from("service_request_events")
      .select("id, event_type, from_status, to_status, note, created_at, actor:profiles!actor_id(full_name)")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !data) return null;
  const row = data as unknown as DetailRow;

  const events: RequestEvent[] = ((eventRows ?? []) as unknown as EventRow[]).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    note: e.note,
    createdAt: e.created_at,
    actorName: e.actor?.full_name ?? null,
  }));

  // Cadeia de trocas ligadas (ver createExchangeChild em actions.ts) -- só
  // busca depois de saber o parent_request_id (a troca anterior), e sempre
  // busca o filho (a próxima rodada) por parent_request_id apontando pra cá.
  // Só um filho existe por chamado (o botão "Nova troca" some assim que um
  // já foi criado), então .maybeSingle() é seguro.
  const [{ data: parentRow }, { data: childRow }] = await Promise.all([
    row.parent_request_id
      ? admin.from("service_requests").select("id, ticket_number, status").eq("id", row.parent_request_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("service_requests").select("id, ticket_number, status").eq("parent_request_id", id).maybeSingle(),
  ]);
  const parentExchange: LinkedExchangeRef | null = parentRow
    ? { id: parentRow.id, ticketNumber: parentRow.ticket_number, status: parentRow.status }
    : null;
  const childExchange: LinkedExchangeRef | null = childRow
    ? { id: childRow.id, ticketNumber: childRow.ticket_number, status: childRow.status }
    : null;

  const request: ServiceRequestDetail = {
    ...toSummary(row),
    clientCpf: row.client_cpf,
    clientAddress: row.client_address,
    clientAddressNumber: row.client_address_number,
    clientIsApartment: row.client_is_apartment,
    clientAddressComplement: row.client_address_complement,
    clientNeighborhood: row.client_neighborhood,
    restrictionNote: row.restriction_note,
    notes: row.notes,
    authorizedBy: row.authorized_by,
    deliveryRating: row.delivery_rating,
    resolutionRating: row.resolution_rating,
    parentExchange,
    childExchange,
  };

  return { request, events };
}

export type OpenRequestForLojaItem = { product: string; quantity: number; partCode: string | null; action: ItemAction | null };

export type OpenRequestForLoja = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  status: RequestStatus;
  storeId: string;
  storeName: string;
  orderCode: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientNeighborhood: string | null;
  productSummary: string | null;
  items: OpenRequestForLojaItem[];
  createdAt: string;
  completedAt: string | null;
  requestedDeadline: string | null;
  deadlineStatus: DeadlineStatus;
  approvedDeadline: string | null;
  assemblerName: string | null;
  driverName: string | null;
  requestedByName: string | null;
  deliveryRating: number | null;
  resolutionRating: number | null;
};

const OPEN_LOJA_LIMIT = 200;

// Visão da loja (gerente autenticado por PIN, ver getLojaGerenteSession) pra
// acompanhar a demanda em aberto (ou, com `onlyCompleted`, o histórico de
// concluídas) -- CPF/endereço completo continuam de fora (só o necessário
// pra dar noção de volume + contato rápido), mas telefone e bairro entram
// pra bater com o que a assistência já vê na fila (mesmo cliente, mesma
// necessidade de identificar sem abrir cada chamado).
export async function listOpenRequestsForLoja(
  opts: {
    storeId?: string;
    storeIds?: string[];
    types?: readonly RequestType[];
    onlyCompleted?: boolean;
    // Ver applyOwnAssemblerStoreExclusion acima.
    excludeOwnAssemblerStoreIds?: string[];
  } = {}
): Promise<OpenRequestForLoja[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("service_requests")
    .select(
      "id, ticket_number, type, status, store_id, order_code, client_name, client_phone, client_neighborhood, created_at, completed_at, requested_deadline, deadline_status, approved_deadline, assembler_name, driver_name, requested_by_name, delivery_rating, resolution_rating, stores(name), items:service_request_items(product, quantity, part_code, item_action)"
    )
    .limit(OPEN_LOJA_LIMIT);

  if (opts.onlyCompleted) {
    query = query.eq("status", "concluida").order("completed_at", { ascending: false });
  } else {
    query = query.not("status", "in", "(concluida,cancelada)").order("created_at", { ascending: true });
  }

  if (opts.storeIds) {
    query = query.in("store_id", opts.storeIds);
  } else if (opts.storeId) {
    query = query.eq("store_id", opts.storeId);
  }

  if (opts.types) {
    query = query.in("type", opts.types as string[]);
  }

  query = applyOwnAssemblerStoreExclusion(query, opts.excludeOwnAssemblerStoreIds);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    ticket_number: number;
    type: RequestType;
    status: RequestStatus;
    store_id: string;
    order_code: string | null;
    client_name: string | null;
    client_phone: string | null;
    client_neighborhood: string | null;
    created_at: string;
    completed_at: string | null;
    requested_deadline: string | null;
    deadline_status: DeadlineStatus;
    approved_deadline: string | null;
    assembler_name: string | null;
    driver_name: string | null;
    requested_by_name: string | null;
    delivery_rating: number | null;
    resolution_rating: number | null;
    stores: { name: string } | null;
    items: { product: string; quantity: number; part_code: string | null; item_action: string | null }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    ticketNumber: row.ticket_number,
    type: row.type,
    status: row.status,
    storeId: row.store_id,
    storeName: row.stores?.name ?? "—",
    orderCode: row.order_code,
    requestedDeadline: row.requested_deadline,
    deadlineStatus: row.deadline_status,
    approvedDeadline: row.approved_deadline,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientNeighborhood: row.client_neighborhood,
    productSummary: row.items && row.items.length > 0 ? row.items.map((i) => i.product).join(", ") : null,
    items: (row.items ?? []).map((i) => ({
      product: i.product,
      quantity: i.quantity,
      partCode: i.part_code,
      action: i.item_action === "montar" || i.item_action === "desmontar" ? (i.item_action as ItemAction) : null,
    })),
    createdAt: row.created_at,
    completedAt: row.completed_at,
    assemblerName: row.assembler_name,
    driverName: row.driver_name,
    requestedByName: row.requested_by_name,
    deliveryRating: row.delivery_rating,
    resolutionRating: row.resolution_rating,
  }));
}

// Lista já vem ordenada (criação asc pra abertas, conclusão desc pra
// concluídas) — aqui só clusteriza itens consecutivos do mesmo dia em blocos,
// preservando a ordem original entre e dentro dos blocos. Compartilhada pelas
// telas de loja (montagens e trocas), que têm a mesma necessidade.
export function groupRequestsByDate(
  requests: OpenRequestForLoja[],
  showCompleted: boolean
): [string, OpenRequestForLoja[]][] {
  const groups = new Map<string, OpenRequestForLoja[]>();
  for (const r of requests) {
    const dateField = showCompleted ? (r.completedAt ?? r.createdAt) : r.createdAt;
    const label = new Date(dateField).toLocaleDateString("pt-BR");
    const group = groups.get(label);
    if (group) group.push(r);
    else groups.set(label, [r]);
  }
  return [...groups.entries()];
}

// Posição de cada chamado de montagem em aberto na fila geral (todas as
// lojas), na mesma ordem que o montador vai atender (ver
// listRequestsForAssembler) — usado pro gerente de loja ver quantas
// montagens de outras lojas estão na frente da dele.
export async function listOpenMontagemQueueIds(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_requests")
    .select("id")
    .eq("type", "montagem")
    .not("status", "in", "(concluida,cancelada)")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(OPEN_LOJA_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

export type DayLoadItem = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  clientName: string | null;
  clientNeighborhood: string | null;
  storeName: string;
  shift: Shift | null;
  scheduledTime: string | null;
};

// Visita (montador) -- exclui os tipos de entrega (motorista/rota, ver
// DELIVERY_REQUEST_TYPES) de ASSISTENCIA_MANAGED_TYPES. Só usado por
// listDayLoad logo abaixo.
const VISITA_TYPES_FOR_DAY_LOAD = ASSISTENCIA_MANAGED_TYPES.filter((t) => !(DELIVERY_REQUEST_TYPES as readonly string[]).includes(t));

// Visitas já agendadas pra um dia específico -- usado no momento de criar
// uma solicitação nova (QuickCreateRequestForm) pra mostrar, assim que a
// assistência escolhe a data, quantas e quais demandas já existem naquele
// dia, sem precisar sair do formulário e ir checar a agenda à parte. Mesma
// prioridade de data de agendaEffectiveDate (scheduled_date primeiro,
// approved_deadline só quando não tem scheduled_date), expressa direto na
// query porque aqui não dá pra trazer tudo e filtrar em JS como a agenda faz
// (essa consulta roda a cada data digitada, precisa ser enxuta).
//
// Só tipo de VISITA (montagem/desmontagem/troca_peça/vistoria) -- achado
// 20/08/2026 (pedido do Victor: "é so para aparecer as montagens ne"): sem
// filtro de tipo, entrega/troca de produto (rota de motorista, sem nenhuma
// relação com a agenda do montador) também aparecia aqui, misturado com as
// visitas de verdade. QuickCreateRequestForm (único chamador) só cria
// tipo de visita mesmo, então o filtro não tira nada que devesse aparecer.
export async function listDayLoad(date: string): Promise<DayLoadItem[]> {
  // Validação estrita antes de interpolar na string do filtro -- `date` vem
  // de input do usuário (mesmo que o <input type="date"> do navegador já
  // restrinja o formato, a action pode ser chamada direto) e injeção aqui
  // poderia manipular a sintaxe do filtro do PostgREST.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_requests")
    .select("id, ticket_number, type, client_name, client_neighborhood, shift, scheduled_time, stores(name)")
    .in("type", [...VISITA_TYPES_FOR_DAY_LOAD])
    .or(`scheduled_date.eq.${date},and(scheduled_date.is.null,approved_deadline.eq.${date})`)
    .not("status", "eq", "cancelada")
    .order("scheduled_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    ticket_number: number;
    type: RequestType;
    client_name: string | null;
    client_neighborhood: string | null;
    shift: Shift | null;
    scheduled_time: string | null;
    stores: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    ticketNumber: r.ticket_number,
    type: r.type,
    clientName: r.client_name,
    clientNeighborhood: r.client_neighborhood,
    storeName: r.stores?.name ?? "—",
    shift: r.shift,
    scheduledTime: r.scheduled_time,
  }));
}

export type AssemblerRequestItem = { id: string; product: string; quantity: number; action: ItemAction | null; completed: boolean };

export type AssemblerRequestView = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  status: RequestStatus;
  storeName: string;
  orderCode: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientAddressNumber: string | null;
  clientIsApartment: boolean;
  clientAddressComplement: string | null;
  clientNeighborhood: string | null;
  productSummary: string | null;
  items: AssemblerRequestItem[];
  scheduledDate: string | null;
  scheduledTime: string | null;
  shift: Shift | null;
  requestedDeadline: string | null;
  approvedDeadline: string | null;
  createdAt: string;
  completedAt: string | null;
  comboMontagemDesmontagem: boolean;
  montadorInstruction: string | null;
  deliveryRating: number | null;
};

// Montagem/desmontagem raramente passa pelo "agendar" (ScheduleField) --
// na prática a assistência só negocia o prazo com a loja (approveDeadline/
// rejectDeadline) e isso vira a data que vale pro montador. Sem esse
// fallback, um chamado sem visita agendada explícita sumia do agrupamento
// por dia da tela do motorista/montador e caía sempre em "Sem data
// agendada", mesmo já tendo uma data combinada. Usado tanto pra ordenar
// (listRequestsForAssembler) quanto pra agrupar/exibir (montador/page.tsx,
// montador/[id]/page.tsx).
export function montadorEffectiveDate(
  r: Pick<AssemblerRequestView, "scheduledDate" | "approvedDeadline" | "requestedDeadline">
): string | null {
  return r.scheduledDate ?? r.approvedDeadline ?? r.requestedDeadline;
}

const ASSEMBLER_VIEW_LIMIT = 200;
// Sem "reason" (Motivo) de propósito -- pode conter detalhe sensível (ex.:
// valor já pago pelo cliente, ver #4578) que o montador não deveria ver.
// Fora da lista de colunas, não só escondido na tela, pra nem trafegar.
// montador_instruction é diferente: campo separado que só assistência/admin
// escreve (ver setMontadorInstruction em actions.ts), pensado justamente
// pra aparecer aqui -- não tem o mesmo risco do Motivo do gerente.
const ASSEMBLER_VIEW_COLUMNS =
  "id, ticket_number, type, status, order_code, client_name, client_phone, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, scheduled_date, scheduled_time, shift, requested_deadline, approved_deadline, created_at, completed_at, combo_montagem_desmontagem, montador_instruction, delivery_rating, stores(name), items:service_request_items(id, product, quantity, item_action, completed)";

type AssemblerViewRow = {
  id: string;
  ticket_number: number;
  type: RequestType;
  status: RequestStatus;
  order_code: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_address_number: string | null;
  client_is_apartment: boolean;
  client_address_complement: string | null;
  client_neighborhood: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  shift: Shift | null;
  requested_deadline: string | null;
  approved_deadline: string | null;
  created_at: string;
  completed_at: string | null;
  combo_montagem_desmontagem: boolean;
  montador_instruction: string | null;
  delivery_rating: number | null;
  stores: { name: string } | null;
  items: { id: string; product: string; quantity: number; item_action: string | null; completed: boolean }[] | null;
};

function toAssemblerView(row: AssemblerViewRow): AssemblerRequestView {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    type: row.type,
    status: row.status,
    storeName: row.stores?.name ?? "—",
    orderCode: row.order_code,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    clientAddressNumber: row.client_address_number,
    clientIsApartment: row.client_is_apartment,
    clientAddressComplement: row.client_address_complement,
    clientNeighborhood: row.client_neighborhood,
    productSummary: row.items && row.items.length > 0 ? row.items.map((i) => i.product).join(", ") : null,
    items: (row.items ?? []).map((i) => ({
      id: i.id,
      product: i.product,
      quantity: i.quantity,
      action: i.item_action === "montar" || i.item_action === "desmontar" ? i.item_action : null,
      completed: i.completed,
    })),
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    shift: row.shift,
    requestedDeadline: row.requested_deadline,
    approvedDeadline: row.approved_deadline,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    comboMontagemDesmontagem: row.combo_montagem_desmontagem,
    montadorInstruction: row.montador_instruction,
    deliveryRating: row.delivery_rating,
  };
}

// Portal do montador (login por nome + PIN, ver src/lib/montadorAuth.ts): só as
// próprias demandas, com o contato/endereço do cliente que ele precisa pra ir
// até lá — diferente da visão da loja, que redige esses dados por ser 100%
// pública sem PIN nenhum.
export async function listRequestsForAssembler(
  assemblerName: string,
  opts: { onlyCompleted?: boolean } = {}
): Promise<AssemblerRequestView[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("service_requests").select(ASSEMBLER_VIEW_COLUMNS).eq("assembler_name", assemblerName).limit(ASSEMBLER_VIEW_LIMIT);

  if (opts.onlyCompleted) {
    query = query.eq("status", "concluida").order("completed_at", { ascending: false });
  } else {
    query = query.not("status", "in", "(concluida,cancelada)");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as AssemblerViewRow[]).map(toAssemblerView);

  if (!opts.onlyCompleted) {
    // Ordenado pela data efetiva (visita agendada, ou -- sem agendamento --
    // o prazo combinado com a loja, ver montadorEffectiveDate acima; quem
    // não tem data nenhuma fica por último) -- feito em JS porque o
    // fallback entre 3 colunas não dá pra expressar num .order() do
    // Supabase sem SQL bruto.
    items.sort((a, b) => {
      const dateA = montadorEffectiveDate(a);
      const dateB = montadorEffectiveDate(b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      const timeA = a.scheduledTime ?? "";
      const timeB = b.scheduledTime ?? "";
      if (timeA !== timeB) return timeA < timeB ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  }

  return items;
}

// Detalhe de um chamado específico pro montador (tela "Ver chamado") — o
// filtro por `assembler_name` já garante que ele só acessa demanda própria,
// sem depender só do que a UI mostra ou esconde.
export async function getAssemblerRequestDetail(
  assemblerName: string,
  requestId: string
): Promise<AssemblerRequestView | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_requests")
    .select(ASSEMBLER_VIEW_COLUMNS)
    .eq("id", requestId)
    .eq("assembler_name", assemblerName)
    .maybeSingle();

  if (error || !data) return null;
  return toAssemblerView(data as unknown as AssemblerViewRow);
}

export type DriverRequestView = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  status: RequestStatus;
  storeName: string;
  clientName: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientAddressNumber: string | null;
  clientIsApartment: boolean;
  clientAddressComplement: string | null;
  clientNeighborhood: string | null;
  productSummary: string | null;
  reason: string | null;
  restrictionNote: string | null;
  clientTimeRestriction: string | null;
  pickupCompleted: boolean;
  scheduledDate: string | null;
  scheduledTime: string | null;
  shift: Shift | null;
  requestedDeadline: string | null;
  approvedDeadline: string | null;
  createdAt: string;
  completedAt: string | null;
  rota: Rota | null;
  rotaExceptionNote: string | null;
  driverOrder: number | null;
  deliveryRating: number | null;
  // Só usado no modo "ver todas as rotas" (ver DISPATCH_SUPERVISOR_DRIVERS) --
  // pro motorista comum é sempre o próprio nome, óbvio demais pra mostrar.
  driverName: string | null;
  // Ver createExchangeChild em actions.ts -- 1 quando é a 1ª troca, 2+
  // quando é uma rodada seguinte de uma cadeia (mostra badge "Nª troca").
  exchangeRound: number;
  // Quem autorizou e quem criou a notificação -- pedido do Victor
  // 18/08/2026: só aparecem no "Ver resumo"/"Ver notificação completa", não
  // na lista compacta da rota (ver DriverNotificationModalButton.tsx e
  // motorista/[id]/page.tsx).
  authorizedBy: string | null;
  requestedByName: string | null;
};

const DRIVER_VIEW_LIMIT = 200;
const DRIVER_VIEW_COLUMNS =
  "id, ticket_number, type, status, client_name, client_phone, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, reason, restriction_note, client_time_restriction, pickup_completed, scheduled_date, scheduled_time, shift, requested_deadline, approved_deadline, created_at, completed_at, rota, rota_exception_note, driver_order, delivery_rating, driver_name, exchange_round, authorized_by, requested_by_name, stores(name), requester:profiles!requested_by(full_name), items:service_request_items(product)";

type DriverViewRow = {
  id: string;
  ticket_number: number;
  type: RequestType;
  status: RequestStatus;
  client_name: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_address_number: string | null;
  client_is_apartment: boolean;
  client_address_complement: string | null;
  client_neighborhood: string | null;
  reason: string | null;
  restriction_note: string | null;
  client_time_restriction: string | null;
  pickup_completed: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  shift: Shift | null;
  requested_deadline: string | null;
  approved_deadline: string | null;
  created_at: string;
  completed_at: string | null;
  rota: Rota | null;
  rota_exception_note: string | null;
  driver_order: number | null;
  delivery_rating: number | null;
  driver_name: string | null;
  exchange_round: number;
  authorized_by: string | null;
  requested_by_name: string | null;
  stores: { name: string } | null;
  requester: { full_name: string } | null;
  items: { product: string }[] | null;
};

function toDriverView(row: DriverViewRow): DriverRequestView {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    type: row.type,
    status: row.status,
    storeName: row.stores?.name ?? "—",
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    clientAddressNumber: row.client_address_number,
    clientIsApartment: row.client_is_apartment,
    clientAddressComplement: row.client_address_complement,
    clientNeighborhood: row.client_neighborhood,
    productSummary: row.items && row.items.length > 0 ? row.items.map((i) => i.product).join(", ") : null,
    reason: row.reason,
    restrictionNote: row.restriction_note,
    clientTimeRestriction: row.client_time_restriction,
    pickupCompleted: row.pickup_completed,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    shift: row.shift,
    requestedDeadline: row.requested_deadline,
    approvedDeadline: row.approved_deadline,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    rota: row.rota,
    rotaExceptionNote: row.rota_exception_note,
    driverOrder: row.driver_order,
    deliveryRating: row.delivery_rating,
    driverName: row.driver_name,
    exchangeRound: row.exchange_round,
    authorizedBy: row.authorized_by,
    requestedByName: row.requester?.full_name ?? row.requested_by_name ?? null,
  };
}

// Portal do motorista (login por nome + PIN, ver src/lib/driverAuth.ts): só as
// próprias rotas de troca de produto (recolher o errado/avariado, entregar o
// correto) -- exceto com `viewAll` (DISPATCH_SUPERVISOR_DRIVER, ver
// assistenciaLabels.ts), que traz de TODOS os motoristas pra acompanhar a
// expedição inteira.
export async function listRequestsForDriver(
  driverName: string,
  opts: { onlyCompleted?: boolean; viewAll?: boolean } = {}
): Promise<DriverRequestView[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("service_requests").select(DRIVER_VIEW_COLUMNS).limit(DRIVER_VIEW_LIMIT);
  if (opts.viewAll) {
    // Sem o filtro por driver_name, precisa restringir por tipo na mão --
    // era o driver_name (só preenchido em tipo de entrega) que limitava
    // implicitamente antes.
    query = query.in("type", [...DELIVERY_REQUEST_TYPES]);
  } else {
    query = query.eq("driver_name", driverName);
  }

  if (opts.onlyCompleted) {
    query = query.eq("status", "concluida").order("completed_at", { ascending: false });
  } else {
    // driver_order primeiro -- o motorista pode reorganizar a própria lista
    // (ver setDriverOrderAction, driver-actions.ts); quem ainda não foi
    // reorganizado (null) cai pro final e usa a ordem padrão por horário.
    query = query
      .not("status", "in", "(concluida,cancelada)")
      .order("driver_order", { ascending: true, nullsFirst: false })
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as DriverViewRow[]).map(toDriverView);
}

// `viewAll` (DISPATCH_SUPERVISOR_DRIVERS) deixa ver o chamado de QUALQUER
// motorista -- só visualização, as ações (concluir/foto/etc.) continuam
// travadas por driver_name real em driver-actions.ts, não daqui.
export async function getDriverRequestDetail(
  driverName: string,
  requestId: string,
  opts: { viewAll?: boolean } = {}
): Promise<DriverRequestView | null> {
  const admin = getSupabaseAdmin();
  let query = admin.from("service_requests").select(DRIVER_VIEW_COLUMNS).eq("id", requestId);
  if (!opts.viewAll) {
    query = query.eq("driver_name", driverName);
  }
  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;
  return toDriverView(data as unknown as DriverViewRow);
}

const SHIFT_ORDER: Record<Shift, number> = { manha: 0, dia: 1, tarde: 2, urgencia: 3 };

export type AgendaRange = "atrasado" | "hoje" | "semana";

// Agenda de visitas técnicas: toda solicitação com data marcada, ordenada por
// data e depois por turno — substitui o controle que era feito à parte na
// planilha "Agenda de Assistência".
// Só scheduledDate (ScheduleField) ou approvedDeadline (approveDeadline/
// rejectDeadline) contam -- as duas são decisão da assistência. De propósito
// SEM cair pro requestedDeadline (o pedido da loja, ainda não aprovado):
// mesma régua já usada na fila principal (ver fila/page.tsx), pra não tratar
// um prazo que a loja só pediu como se fosse data confirmada.
export function agendaEffectiveDate(r: Pick<ServiceRequestSummary, "scheduledDate" | "approvedDeadline">): string | null {
  return r.scheduledDate ?? r.approvedDeadline;
}

export async function listScheduledRequests(
  opts: { range?: AgendaRange; month?: string } = {}
): Promise<ServiceRequestSummary[]> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Antes só trazia quem tinha scheduled_date (o campo "Agendar visita")
  // explicitamente preenchido -- um chamado com prazo já aprovado pela
  // assistência (approveDeadline/rejectDeadline), mas que nunca passou por
  // esse campo específico, sumia da agenda inteira, não só sem uma
  // informação: o chamado inteiro ficava invisível. Owner .or() pra trazer
  // quem tem qualquer uma das duas datas -- o filtro por período (abaixo) e
  // a ordenação usam agendaEffectiveDate (o mesmo "qual data vale" da fila),
  // calculado em JS porque não dá pra expressar um coalesce de 2 colunas no
  // builder do Supabase sem SQL bruto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = admin
    .from("service_requests")
    .select(SUMMARY_COLUMNS)
    .or("scheduled_date.not.is.null,approved_deadline.not.is.null");

  const { data, error } = (await query) as { data: SummaryRow[] | null; error: { message: string } | null };
  if (error) throw new Error(error.message);

  let items = ((data ?? []) as unknown as SummaryRow[]).map(toSummary);

  if (opts.range === "atrasado") {
    items = items.filter((r) => {
      const d = agendaEffectiveDate(r);
      return !!d && d < today && r.status !== "concluida" && r.status !== "cancelada";
    });
  } else if (opts.range === "hoje") {
    items = items.filter((r) => agendaEffectiveDate(r) === today);
  } else if (opts.range === "semana") {
    items = items.filter((r) => {
      const d = agendaEffectiveDate(r);
      return !!d && d >= today && d <= in7Days;
    });
  } else if (opts.month) {
    // "Tudo" (nenhum range escolhido) limitado ao mês corrente por padrão --
    // pedido do Victor 25/08/2026: "Se a opção padrão for 'Tudo', limite
    // por padrão ao mês corrente" (senão a lista mistura anos de histórico
    // com o que falta agendar, sem filtro nenhum). Navegação de mês
    // (</>) troca esse valor -- ver buildHref em agenda/page.tsx.
    items = items.filter((r) => (agendaEffectiveDate(r) ?? "").slice(0, 7) === opts.month);
  }

  return items.sort((a, b) => {
    const dateCompare = (agendaEffectiveDate(a) ?? "").localeCompare(agendaEffectiveDate(b) ?? "");
    if (dateCompare !== 0) return dateCompare;
    // assistencia_order primeiro (a assistência pode reorganizar o dia, ver
    // AgendaQueueGroup.tsx) -- quem ainda não foi reorganizado (null) cai
    // pro final e usa a ordem padrão por turno/horário.
    const orderA = a.assistenciaOrder;
    const orderB = b.assistenciaOrder;
    if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
    if (orderA !== null && orderB === null) return -1;
    if (orderA === null && orderB !== null) return 1;
    const shiftCompare = (SHIFT_ORDER[a.shift ?? "dia"] ?? 99) - (SHIFT_ORDER[b.shift ?? "dia"] ?? 99);
    if (shiftCompare !== 0) return shiftCompare;
    // Sem ordem manual, dentro do mesmo turno: agrupa por bairro antes do
    // horário -- ajuda a planejar a rota de despacho (visitas próximas
    // ficam juntas na lista), sem bagunçar o agrupamento por turno em si.
    const neighborhoodCompare = (a.clientNeighborhood ?? "").localeCompare(b.clientNeighborhood ?? "");
    if (neighborhoodCompare !== 0) return neighborhoodCompare;
    return (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "");
  });
}

export type RequestsOverview = {
  openNoContact: number;
  pendingDeadline: number;
  scheduledToday: number;
  needsReschedule: number;
  completedToday: number;
};

// Contagens rápidas ("o que precisa de mim agora") pra tela inicial —
// sem trazer as linhas inteiras, só o total de cada uma. `excludeOwnAssemblerStoreIds`
// (ver applyOwnAssemblerStoreExclusion) evita que o badge da aba
// "Solicitações"/o resumo da inicial denuncie, só pelo número, que tem
// montagem/desmontagem/vistoria pendente de loja com montador próprio pra
// quem não devia nem saber que ela existe.
export async function countRequestsOverview(excludeOwnAssemblerStoreIds?: string[]): Promise<RequestsOverview> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const openQuery = applyOwnAssemblerStoreExclusion(
    admin.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "aberta"),
    excludeOwnAssemblerStoreIds
  );
  const deadlineQuery = applyOwnAssemblerStoreExclusion(
    admin
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("deadline_status", "pendente")
      .not("status", "in", "(concluida,cancelada)"),
    excludeOwnAssemblerStoreIds
  );
  const todayQuery = applyOwnAssemblerStoreExclusion(
    admin.from("service_requests").select("id", { count: "exact", head: true }).eq("scheduled_date", today),
    excludeOwnAssemblerStoreIds
  );
  const remarcarQuery = applyOwnAssemblerStoreExclusion(
    admin.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "remarcar"),
    excludeOwnAssemblerStoreIds
  );
  const completedTodayQuery = applyOwnAssemblerStoreExclusion(
    admin
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluida")
      .gte("completed_at", `${today}T00:00:00`)
      .lte("completed_at", `${today}T23:59:59`),
    excludeOwnAssemblerStoreIds
  );

  const [openRes, deadlineRes, todayRes, remarcarRes, completedTodayRes] = await Promise.all([
    openQuery,
    deadlineQuery,
    todayQuery,
    remarcarQuery,
    completedTodayQuery,
  ]);

  return {
    openNoContact: openRes.count ?? 0,
    pendingDeadline: deadlineRes.count ?? 0,
    scheduledToday: todayRes.count ?? 0,
    needsReschedule: remarcarRes.count ?? 0,
    completedToday: completedTodayRes.count ?? 0,
  };
}

// Badge do card "Montagens e serviços" no painel do SAC -- mesmo espírito
// de countRequestsOverview/countPedidosEncomendaSolicitados.
export async function countMontagensOverview(excludeOwnAssemblerStoreIds?: string[]): Promise<number> {
  const admin = getSupabaseAdmin();
  const query = applyOwnAssemblerStoreExclusion(
    admin
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .in("type", [...ASSISTENCIA_MANAGED_TYPES])
      .not("status", "in", "(concluida,cancelada)"),
    excludeOwnAssemblerStoreIds
  );
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Badge da aba "Solicitações" (AssistenciaNav, admin/assistência) --
// pedido do Victor 21/08/2026: "só faz sentido aparecer ali o número de
// solicitações em aberto das montagens/desmontagens" -- antes usava
// countRequestsOverview().openNoContact, que conta TODO tipo aberto,
// inclusive entrega/notificação de assistência (que tem badge própria na
// aba dela, ver countEntregasOverview logo abaixo, e nem usa status
// "aberta" do mesmo jeito). Mesmo escopo de tipo da aba "Visitas" em
// fila/page.tsx (VISITA_REQUEST_TYPES), só que contando "aberta" (sem
// contato ainda) em vez de "não concluída/cancelada".
export async function countVisitasOpenNoContact(excludeOwnAssemblerStoreIds?: string[]): Promise<number> {
  const admin = getSupabaseAdmin();
  const query = applyOwnAssemblerStoreExclusion(
    admin
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "aberta")
      .in("type", [...VISITA_REQUEST_TYPES]),
    excludeOwnAssemblerStoreIds
  );
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Badge da aba "Notificação de Assistência" no painel do SAC -- mesmo
// espírito de countMontagensOverview, pros tipos que saíram de
// "Solicitações" pra essa aba própria (ver /assistencia/sac/notificacoes,
// 17/08/2026). Sem exclusão de loja com montador próprio -- isso é regra
// só de montagem/desmontagem/vistoria, não de entrega.
export async function countEntregasOverview(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .in("type", [...DELIVERY_REQUEST_TYPES])
    .not("status", "in", "(concluida,cancelada)");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type RecentlyHandledRequest = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  status: RequestStatus;
  clientName: string | null;
  storeName: string;
  handledAt: string;
};

// Substitui o "Nenhuma notificação" vazio do painel do SAC quando não há
// chamado em aberto pra mostrar -- os últimos chamados que o próprio
// usuário logado movimentou (não é "criados por", é qualquer evento de
// status/nota que ele tenha registrado). Duas consultas independentes
// (eventos, depois os chamados) em vez de um join, porque o que queremos é
// o chamado mais recente POR chamado (deduplicado), não um evento por vez.
export async function listRecentlyHandledBySac(profileId: string, limit = 3): Promise<RecentlyHandledRequest[]> {
  const admin = getSupabaseAdmin();
  const { data: eventRows, error: eventsError } = await admin
    .from("service_request_events")
    .select("request_id, created_at")
    .eq("actor_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit * 5);
  if (eventsError) throw new Error(eventsError.message);

  const seen = new Set<string>();
  const recentIds: { id: string; handledAt: string }[] = [];
  for (const row of eventRows ?? []) {
    if (seen.has(row.request_id)) continue;
    seen.add(row.request_id);
    recentIds.push({ id: row.request_id, handledAt: row.created_at });
    if (recentIds.length >= limit) break;
  }
  if (recentIds.length === 0) return [];

  const { data: requestRows, error: requestsError } = await admin
    .from("service_requests")
    .select("id, ticket_number, type, status, client_name, stores(name)")
    .in(
      "id",
      recentIds.map((r) => r.id)
    );
  if (requestsError) throw new Error(requestsError.message);

  const byId = new Map((requestRows ?? []).map((r) => [r.id as string, r]));
  return recentIds
    .map(({ id, handledAt }) => {
      const row = byId.get(id);
      if (!row) return null;
      // `stores` vem como objeto ou array de 1 dependendo de como o
      // postgrest-js infere a relação -- cobre os dois formatos.
      const storesField = row.stores as { name: string }[] | { name: string } | null;
      const storeName = (Array.isArray(storesField) ? storesField[0] : storesField)?.name ?? "—";
      return {
        id,
        ticketNumber: row.ticket_number as number,
        type: row.type as RequestType,
        status: row.status as RequestStatus,
        clientName: row.client_name as string | null,
        storeName,
        handledAt,
      };
    })
    .filter((r): r is RecentlyHandledRequest => r !== null);
}

// Um chamado dentro de uma linha agregada -- pra permitir "clicar e ver os
// detalhes" em cada linha das tabelas de relatório (pedido do Victor
// 21/08/2026: "em todas as listas, assim que clicar, mostrar os
// detalhes"), sem precisar de uma consulta nova por linha: os dados já
// vêm da mesma query que gera a contagem, só preservados em vez de
// descartados depois de contar.
export type ReportRowItem = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  status: RequestStatus;
  clientName: string | null;
  storeName: string;
  createdAt: string;
  // Descrição livre do problema, preenchida na criação do chamado --
  // pedido do Victor 24/08/2026: ao clicar num grupo de causa raiz
  // (ex.: "Erro do vendedor"), "preciso que apareça qual foi o erro ao
  // clicar, e não em quais chamados foram os erros" -- o número do
  // chamado sozinho não dizia o QUE aconteceu, só onde procurar. `reason`
  // é o mesmo campo que já aparece como "Problema" na notificação
  // impressa (ver DespachoCard.tsx).
  reason: string | null;
};

export type ReportRow = { key: string; total: number; concluida: number; cancelada: number; items: ReportRowItem[] };

export type RequestsReport = {
  byStore: ReportRow[];
  bySeller: ReportRow[];
  byType: ReportRow[];
  // Só troca_produto tem causa_raiz preenchida -- por isso NÃO passa pelo
  // filtro `types` como o resto do relatório (ver scopedRows abaixo):
  // restringir a query a montagem/desmontagem (pedido do Victor
  // 24/08/2026 pro relatório principal) apagaria essa seção inteira, que
  // é sobre troca de produto, não montagem.
  byCausaRaiz: ReportRow[];
  totalRequests: number;
};

// Relatório por período — a planilha permitia filtrar/dinamizar por data,
// loja, vendedor; aqui é a mesma coisa, mas dentro do app.
//
// `alvo` filtra entre montagem de mostruário (a loja monta pra exposição
// própria, sem cliente real -- ver isMostruarioRequest) e cliente de
// verdade -- pedido do Victor 21/08/2026: "coloque Filtro de montagem de
// mostruário e cliente". `types` restringe o relatório principal (loja/
// tipo/vendedor/total) a um subconjunto de tipos -- pedido do Victor
// 24/08/2026: "nas solicitações por periodo, deve mostrar apenas
// solicitações de montagem/desmontagem" -- mas NÃO afeta `byCausaRaiz`
// (ver comentário em RequestsReport acima, é sobre troca_produto, tipo
// diferente de propósito).
export async function getRequestsReport(
  opts: { dateFrom?: string; dateTo?: string; alvo?: "mostruario" | "cliente"; types?: RequestType[] } = {}
): Promise<RequestsReport> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("service_requests")
    .select("id, ticket_number, store_id, seller_name, type, status, causa_raiz, reason, created_at, order_code, client_name, stores(name)");

  if (opts.dateFrom) query = query.gte("created_at", opts.dateFrom);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59`);
  // Sem filtro de `type` na query -- ver comentário acima, causa_raiz
  // precisa das linhas de troca_produto mesmo quando `types` pede só
  // montagem/desmontagem pro resto do relatório.

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    ticket_number: number;
    store_id: string;
    seller_name: string | null;
    type: RequestType;
    status: RequestStatus;
    causa_raiz: string | null;
    reason: string | null;
    created_at: string;
    order_code: string | null;
    client_name: string | null;
    stores: { name: string } | null;
  };
  const allRows = (data ?? []) as unknown as Row[];
  const rows = opts.alvo
    ? allRows.filter((r) => isMostruarioRequest(r.order_code, r.client_name) === (opts.alvo === "mostruario"))
    : allRows;
  // Escopo do relatório principal (loja/tipo/vendedor/total) -- causa
  // raiz continua sobre `rows` inteiro, sem essa restrição.
  const scopedRows = opts.types ? rows.filter((r) => opts.types!.includes(r.type)) : rows;

  function aggregate(rowsForAgg: Row[], keyFn: (r: Row) => string | null): ReportRow[] {
    const map = new Map<string, ReportRow>();
    for (const r of rowsForAgg) {
      const key = keyFn(r);
      if (!key) continue;
      const entry = map.get(key) ?? { key, total: 0, concluida: 0, cancelada: 0, items: [] };
      entry.total++;
      if (r.status === "concluida") entry.concluida++;
      if (r.status === "cancelada") entry.cancelada++;
      entry.items.push({
        id: r.id,
        ticketNumber: r.ticket_number,
        type: r.type,
        status: r.status,
        clientName: r.client_name,
        storeName: r.stores?.name ?? r.store_id,
        createdAt: r.created_at,
        reason: r.reason,
      });
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  return {
    byStore: aggregate(scopedRows, (r) => r.stores?.name ?? r.store_id),
    bySeller: aggregate(scopedRows, (r) => r.seller_name),
    byType: aggregate(scopedRows, (r) => r.type),
    byCausaRaiz: aggregate(rows, (r) => r.causa_raiz),
    totalRequests: scopedRows.length,
  };
}

// Mesma ideia de ReportRowItem acima -- item cru guardado do lado de cada
// contagem, pra dar pra expandir e ver os chamados de verdade por trás de
// cada linha (mês/montador/loja). `type` só importa de verdade no modo
// "todos" (ver getServiceTypeIndicators) -- com um tipo só selecionado é
// sempre o mesmo valor repetido, mas não custa nada guardar sempre.
export type IndicatorItem = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  clientName: string | null;
  status: RequestStatus;
  createdAt: string;
};

export type MonthCount = { month: string; total: number; concluida: number; items: IndicatorItem[] };
export type AssemblerCount = {
  assemblerName: string;
  total: number;
  concluida: number;
  avgDaysToComplete: number | null;
  items: IndicatorItem[];
};
export type StoreCount = { storeId: string; storeName: string; total: number; concluida: number; items: IndicatorItem[] };

export type ServiceTypeIndicators = {
  byMonth: MonthCount[];
  byAssembler: AssemblerCount[];
  byStore: StoreCount[];
};

// Indicadores operacionais de UM tipo de solicitação por vez (padrão:
// montagem), ou de TODOS os tipos juntos (type === "todos") — volume por
// mês, por montador (com tempo médio até concluir) e por loja.
// "todos" -- pedido do Victor 21/08/2026: "preciso que tenha uma opção no
// seletor para 'ver tudo'" (a comparação dele entre esse total por
// montador e a lista de Solicitações batia certinho pro tipo selecionado,
// só que aqui só dava pra ver um tipo de cada vez -- estava correto, só
// faltava essa opção). Complementa getRequestsReport, que já agrega todos
// os tipos juntos mas sem quebrar por mês/montador/loja.
export async function getServiceTypeIndicators(
  type: RequestType | "todos",
  opts: { dateFrom?: string; dateTo?: string } = {}
): Promise<ServiceTypeIndicators> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("service_requests")
    .select("id, ticket_number, store_id, type, assembler_name, status, client_name, created_at, completed_at, stores(name)");
  if (type !== "todos") query = query.eq("type", type);

  if (opts.dateFrom) query = query.gte("created_at", opts.dateFrom);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    ticket_number: number;
    store_id: string;
    type: RequestType;
    assembler_name: string | null;
    status: RequestStatus;
    client_name: string | null;
    created_at: string;
    completed_at: string | null;
    stores: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const monthMap = new Map<string, MonthCount>();
  const assemblerMap = new Map<string, { total: number; concluida: number; daysSum: number; daysCount: number; items: IndicatorItem[] }>();
  const storeMap = new Map<string, StoreCount>();

  for (const r of rows) {
    const item: IndicatorItem = {
      id: r.id,
      ticketNumber: r.ticket_number,
      type: r.type,
      clientName: r.client_name,
      status: r.status,
      createdAt: r.created_at,
    };

    const month = r.created_at.slice(0, 7);
    const monthEntry = monthMap.get(month) ?? { month, total: 0, concluida: 0, items: [] };
    monthEntry.total++;
    if (r.status === "concluida") monthEntry.concluida++;
    monthEntry.items.push(item);
    monthMap.set(month, monthEntry);

    const assemblerName = r.assembler_name ?? "Sem montador definido";
    const assemblerEntry = assemblerMap.get(assemblerName) ?? { total: 0, concluida: 0, daysSum: 0, daysCount: 0, items: [] };
    assemblerEntry.total++;
    if (r.status === "concluida") {
      assemblerEntry.concluida++;
      if (r.completed_at) {
        const days = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
        assemblerEntry.daysSum += days;
        assemblerEntry.daysCount++;
      }
    }
    assemblerEntry.items.push(item);
    assemblerMap.set(assemblerName, assemblerEntry);

    const storeEntry = storeMap.get(r.store_id) ?? { storeId: r.store_id, storeName: r.stores?.name ?? r.store_id, total: 0, concluida: 0, items: [] };
    storeEntry.total++;
    if (r.status === "concluida") storeEntry.concluida++;
    storeEntry.items.push(item);
    storeMap.set(r.store_id, storeEntry);
  }

  return {
    byMonth: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    byAssembler: [...assemblerMap.entries()]
      .map(([assemblerName, v]) => ({
        assemblerName,
        total: v.total,
        concluida: v.concluida,
        avgDaysToComplete: v.daysCount > 0 ? v.daysSum / v.daysCount : null,
        items: v.items,
      }))
      .sort((a, b) => b.total - a.total),
    byStore: [...storeMap.values()].sort((a, b) => b.total - a.total),
  };
}
