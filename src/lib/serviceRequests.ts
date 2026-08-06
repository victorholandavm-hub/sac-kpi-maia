import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";
import type { Rota } from "./rotas";

export type RequestType =
  | "montagem"
  | "desmontagem"
  | "recolhimento"
  | "troca_peca"
  | "vistoria"
  | "notificacao_externa"
  | "troca_produto"
  | "entrega_produto"
  | "envio_peca";
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

export function isRequestStatus(value: string | undefined | null): value is RequestStatus {
  return !!value && (REQUEST_STATUSES as string[]).includes(value);
}

// Montagem/desmontagem envolve entrar num prédio de verdade — sem número
// (e apto, quando for o caso) o montador/motorista chega no endereço e não
// sabe onde tocar a campainha. Os outros tipos com endereço (recolhimento,
// troca de peça, vistoria) continuam com endereço livre, sem exigir número
// separado.
export const ADDRESS_NUMBER_REQUIRED_TYPES: RequestType[] = ["montagem", "desmontagem"];

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
  sellerName: string | null;
  invoiceNumber: string | null;
  sacCategory: string | null;
  protocolNumber: string | null;
  legalDeadline: string | null;
  escalationRisk: boolean;
  comboMontagemDesmontagem: boolean;
  assistenciaOrder: number | null;
  montadorInstruction: string | null;
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
  seller_name: string | null;
  invoice_number: string | null;
  sac_category: string | null;
  protocol_number: string | null;
  legal_deadline: string | null;
  escalation_risk: boolean;
  combo_montagem_desmontagem: boolean;
  assistencia_order: number | null;
  montador_instruction: string | null;
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
  "id, ticket_number, type, status, store_id, order_code, client_name, client_phone, client_neighborhood, reason, requested_by_name, requested_deadline, deadline_status, approved_deadline, assembler_name, driver_name, pickup_completed, scheduled_date, scheduled_time, shift, rota, rota_exception_note, seller_name, invoice_number, sac_category, protocol_number, legal_deadline, escalation_risk, combo_montagem_desmontagem, assistencia_order, montador_instruction, created_at, updated_at, completed_at, assigned_to, stores(name), assigned:profiles!assigned_to(full_name), requester:profiles!requested_by(full_name), items:service_request_items(id, product, part_code, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, item_action, completed)";

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
    sellerName: row.seller_name,
    invoiceNumber: row.invoice_number,
    sacCategory: row.sac_category,
    protocolNumber: row.protocol_number,
    legalDeadline: row.legal_deadline,
    escalationRisk: row.escalation_risk,
    comboMontagemDesmontagem: row.combo_montagem_desmontagem,
    assistenciaOrder: row.assistencia_order,
    montadorInstruction: row.montador_instruction,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    assignedToId: row.assigned_to,
    assignedToName: row.assigned?.full_name ?? null,
  };
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
  } = {}
): Promise<ListRequestsResult> {
  const admin = getSupabaseAdmin();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = REQUESTS_PAGE_SIZE;

  // Tipado como `any` de propósito (ver listScheduledRequests): encadear vários
  // filtros condicionais faz o TypeScript travar tentando inferir um tipo
  // genérico profundo demais.
  // assistencia_order primeiro -- a assistência pode reorganizar a fila (ex.:
  // agrupar visualmente por bairro pra despachar montador, ver
  // setAssistenciaOrderAction); quem ainda não foi reorganizado (null) cai
  // pro final e usa a ordem padrão por data de criação. Mesma ideia de
  // driver_order em listRequestsForDriver.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin
    .from("service_requests")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("assistencia_order", { ascending: true, nullsFirst: false })
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
};

export type RequestEvent = {
  id: string;
  eventType:
    | "created"
    | "status_changed"
    | "assigned"
    | "note_added"
    | "deadline_approved"
    | "deadline_rejected"
    | "edited";
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
  "id, ticket_number, type, status, store_id, order_code, client_name, client_phone, client_cpf, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, reason, restriction_note, notes, montador_instruction, requested_by_name, requested_deadline, deadline_status, approved_deadline, assembler_name, driver_name, pickup_completed, delivery_rating, resolution_rating, scheduled_date, scheduled_time, shift, seller_name, invoice_number, sac_category, protocol_number, legal_deadline, escalation_risk, combo_montagem_desmontagem, created_at, updated_at, completed_at, assigned_to, stores(name), requester:profiles!requested_by(full_name), assigned:profiles!assigned_to(full_name), items:service_request_items(id, product, part_code, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, item_action, completed)";

export async function getRequestDetail(
  id: string
): Promise<{ request: ServiceRequestDetail; events: RequestEvent[] } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("service_requests").select(DETAIL_COLUMNS).eq("id", id).single();

  if (error || !data) return null;
  const row = data as unknown as DetailRow;

  const { data: eventRows } = await admin
    .from("service_request_events")
    .select("id, event_type, from_status, to_status, note, created_at, actor:profiles!actor_id(full_name)")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  const events: RequestEvent[] = ((eventRows ?? []) as unknown as EventRow[]).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    note: e.note,
    createdAt: e.created_at,
    actorName: e.actor?.full_name ?? null,
  }));

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
    deliveryRating: row.delivery_rating,
    resolutionRating: row.resolution_rating,
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
};

const OPEN_LOJA_LIMIT = 200;

// Visão da loja (gerente autenticado por PIN, ver getLojaGerenteSession) pra
// acompanhar a demanda em aberto (ou, com `onlyCompleted`, o histórico de
// concluídas) -- CPF/endereço completo continuam de fora (só o necessário
// pra dar noção de volume + contato rápido), mas telefone e bairro entram
// pra bater com o que a assistência já vê na fila (mesmo cliente, mesma
// necessidade de identificar sem abrir cada chamado).
export async function listOpenRequestsForLoja(
  opts: { storeId?: string; storeIds?: string[]; types?: readonly RequestType[]; onlyCompleted?: boolean } = {}
): Promise<OpenRequestForLoja[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("service_requests")
    .select(
      "id, ticket_number, type, status, store_id, client_name, client_phone, client_neighborhood, created_at, completed_at, requested_deadline, deadline_status, approved_deadline, assembler_name, driver_name, requested_by_name, stores(name), items:service_request_items(product, quantity, part_code, item_action)"
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

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    ticket_number: number;
    type: RequestType;
    status: RequestStatus;
    store_id: string;
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

export type AssemblerRequestItem = { id: string; product: string; quantity: number; action: ItemAction | null; completed: boolean };

export type AssemblerRequestView = {
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
  "id, ticket_number, type, status, client_name, client_phone, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, scheduled_date, scheduled_time, shift, requested_deadline, approved_deadline, created_at, completed_at, combo_montagem_desmontagem, montador_instruction, stores(name), items:service_request_items(id, product, quantity, item_action, completed)";

type AssemblerViewRow = {
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
  scheduled_date: string | null;
  scheduled_time: string | null;
  shift: Shift | null;
  requested_deadline: string | null;
  approved_deadline: string | null;
  created_at: string;
  completed_at: string | null;
  combo_montagem_desmontagem: boolean;
  montador_instruction: string | null;
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
};

const DRIVER_VIEW_LIMIT = 200;
const DRIVER_VIEW_COLUMNS =
  "id, ticket_number, type, status, client_name, client_phone, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, reason, restriction_note, pickup_completed, scheduled_date, scheduled_time, shift, requested_deadline, approved_deadline, created_at, completed_at, rota, rota_exception_note, driver_order, stores(name), items:service_request_items(product)";

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
  stores: { name: string } | null;
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
  };
}

// Portal do motorista (login por nome + PIN, ver src/lib/driverAuth.ts): só as
// próprias rotas de troca de produto (recolher o errado/avariado, entregar o
// correto).
export async function listRequestsForDriver(
  driverName: string,
  opts: { onlyCompleted?: boolean } = {}
): Promise<DriverRequestView[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("service_requests").select(DRIVER_VIEW_COLUMNS).eq("driver_name", driverName).limit(DRIVER_VIEW_LIMIT);

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

export async function getDriverRequestDetail(driverName: string, requestId: string): Promise<DriverRequestView | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_requests")
    .select(DRIVER_VIEW_COLUMNS)
    .eq("id", requestId)
    .eq("driver_name", driverName)
    .maybeSingle();

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
  opts: { range?: AgendaRange } = {}
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
  }

  return items.sort((a, b) => {
    const dateCompare = (agendaEffectiveDate(a) ?? "").localeCompare(agendaEffectiveDate(b) ?? "");
    if (dateCompare !== 0) return dateCompare;
    const shiftCompare = (SHIFT_ORDER[a.shift ?? "dia"] ?? 99) - (SHIFT_ORDER[b.shift ?? "dia"] ?? 99);
    if (shiftCompare !== 0) return shiftCompare;
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
// sem trazer as linhas inteiras, só o total de cada uma.
export async function countRequestsOverview(): Promise<RequestsOverview> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const openQuery = admin.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "aberta");
  const deadlineQuery = admin
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("deadline_status", "pendente")
    .not("status", "in", "(concluida,cancelada)");
  const todayQuery = admin
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_date", today);
  const remarcarQuery = admin.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "remarcar");
  const completedTodayQuery = admin
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "concluida")
    .gte("completed_at", `${today}T00:00:00`)
    .lte("completed_at", `${today}T23:59:59`);

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

export type ReportRow = { key: string; total: number; concluida: number; cancelada: number };

export type RequestsReport = {
  byStore: ReportRow[];
  bySeller: ReportRow[];
  byType: ReportRow[];
  totalRequests: number;
};

// Relatório por período — a planilha permitia filtrar/dinamizar por data,
// loja, vendedor; aqui é a mesma coisa, mas dentro do app.
export async function getRequestsReport(opts: { dateFrom?: string; dateTo?: string } = {}): Promise<RequestsReport> {
  const admin = getSupabaseAdmin();
  let query = admin.from("service_requests").select("store_id, seller_name, type, status, created_at, stores(name)");

  if (opts.dateFrom) query = query.gte("created_at", opts.dateFrom);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    store_id: string;
    seller_name: string | null;
    type: RequestType;
    status: RequestStatus;
    created_at: string;
    stores: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  function aggregate(keyFn: (r: Row) => string | null): ReportRow[] {
    const map = new Map<string, ReportRow>();
    for (const r of rows) {
      const key = keyFn(r);
      if (!key) continue;
      const entry = map.get(key) ?? { key, total: 0, concluida: 0, cancelada: 0 };
      entry.total++;
      if (r.status === "concluida") entry.concluida++;
      if (r.status === "cancelada") entry.cancelada++;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  return {
    byStore: aggregate((r) => r.stores?.name ?? r.store_id),
    bySeller: aggregate((r) => r.seller_name),
    byType: aggregate((r) => r.type),
    totalRequests: rows.length,
  };
}

export type MonthCount = { month: string; total: number; concluida: number };
export type AssemblerCount = { assemblerName: string; total: number; concluida: number; avgDaysToComplete: number | null };
export type StoreCount = { storeId: string; storeName: string; total: number; concluida: number };

export type ServiceTypeIndicators = {
  byMonth: MonthCount[];
  byAssembler: AssemblerCount[];
  byStore: StoreCount[];
};

// Indicadores operacionais de UM tipo de solicitação por vez (padrão:
// montagem) — volume por mês, por montador (com tempo médio até concluir) e
// por loja. Complementa getRequestsReport, que agrega todos os tipos juntos
// sem quebrar por mês nem por montador.
export async function getServiceTypeIndicators(
  type: RequestType,
  opts: { dateFrom?: string; dateTo?: string } = {}
): Promise<ServiceTypeIndicators> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("service_requests")
    .select("store_id, assembler_name, status, created_at, completed_at, stores(name)")
    .eq("type", type);

  if (opts.dateFrom) query = query.gte("created_at", opts.dateFrom);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    store_id: string;
    assembler_name: string | null;
    status: RequestStatus;
    created_at: string;
    completed_at: string | null;
    stores: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const monthMap = new Map<string, MonthCount>();
  const assemblerMap = new Map<string, { total: number; concluida: number; daysSum: number; daysCount: number }>();
  const storeMap = new Map<string, StoreCount>();

  for (const r of rows) {
    const month = r.created_at.slice(0, 7);
    const monthEntry = monthMap.get(month) ?? { month, total: 0, concluida: 0 };
    monthEntry.total++;
    if (r.status === "concluida") monthEntry.concluida++;
    monthMap.set(month, monthEntry);

    const assemblerName = r.assembler_name ?? "Sem montador definido";
    const assemblerEntry = assemblerMap.get(assemblerName) ?? { total: 0, concluida: 0, daysSum: 0, daysCount: 0 };
    assemblerEntry.total++;
    if (r.status === "concluida") {
      assemblerEntry.concluida++;
      if (r.completed_at) {
        const days = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
        assemblerEntry.daysSum += days;
        assemblerEntry.daysCount++;
      }
    }
    assemblerMap.set(assemblerName, assemblerEntry);

    const storeEntry = storeMap.get(r.store_id) ?? { storeId: r.store_id, storeName: r.stores?.name ?? r.store_id, total: 0, concluida: 0 };
    storeEntry.total++;
    if (r.status === "concluida") storeEntry.concluida++;
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
      }))
      .sort((a, b) => b.total - a.total),
    byStore: [...storeMap.values()].sort((a, b) => b.total - a.total),
  };
}
