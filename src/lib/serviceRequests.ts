import { getSupabaseAdmin } from "./supabaseAdmin";
import type { Profile } from "./dal";

export type RequestType = "montagem" | "desmontagem" | "recolhimento" | "notificacao_externa";
export type RequestStatus = "aberta" | "em_contato" | "em_andamento" | "concluida" | "cancelada";
export type DeadlineStatus = "pendente" | "aprovado" | "recusado";

export const REQUEST_STATUSES: RequestStatus[] = [
  "aberta",
  "em_contato",
  "em_andamento",
  "concluida",
  "cancelada",
];

export function isRequestStatus(value: string | undefined | null): value is RequestStatus {
  return !!value && (REQUEST_STATUSES as string[]).includes(value);
}

export type Store = { id: string; name: string };

export async function listStores(): Promise<Store[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("stores").select("id, name").order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type RequestItem = {
  id: string;
  product: string;
  quantity: number;
  unitValue: number | null;
  paymentReleased: boolean;
};

type ItemRow = {
  id: string;
  product: string;
  quantity: number;
  unit_value: number | null;
  payment_released: boolean;
};

export type ServiceRequestSummary = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  storeId: string;
  storeName: string;
  orderCode: string | null;
  clientName: string | null;
  clientPhone: string | null;
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
};

type SummaryRow = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  store_id: string;
  order_code: string | null;
  client_name: string | null;
  client_phone: string | null;
  reason: string | null;
  requested_by_name: string | null;
  requested_deadline: string | null;
  deadline_status: DeadlineStatus;
  approved_deadline: string | null;
  assembler_name: string | null;
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
  "id, type, status, store_id, order_code, client_name, client_phone, reason, requested_by_name, requested_deadline, deadline_status, approved_deadline, assembler_name, created_at, updated_at, completed_at, assigned_to, stores(name), assigned:profiles!assigned_to(full_name), requester:profiles!requested_by(full_name), items:service_request_items(id, product, quantity, unit_value, payment_released)";

function toItem(row: ItemRow): RequestItem {
  return {
    id: row.id,
    product: row.product,
    quantity: row.quantity,
    unitValue: row.unit_value,
    paymentReleased: row.payment_released,
  };
}

function toSummary(row: SummaryRow): ServiceRequestSummary {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    storeId: row.store_id,
    storeName: row.stores?.name ?? row.store_id,
    orderCode: row.order_code,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    items: (row.items ?? []).map(toItem),
    reason: row.reason,
    requestedByName: row.requester?.full_name ?? row.requested_by_name ?? null,
    requestedDeadline: row.requested_deadline,
    deadlineStatus: row.deadline_status,
    approvedDeadline: row.approved_deadline,
    assemblerName: row.assembler_name,
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
  profile: Profile,
  opts: { status?: RequestStatus; q?: string; page?: number } = {}
): Promise<ListRequestsResult> {
  const admin = getSupabaseAdmin();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = REQUESTS_PAGE_SIZE;

  let query = admin
    .from("service_requests")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (profile.role === "gerente") {
    query = query.eq("store_id", profile.storeId ?? "__none__");
  }
  if (opts.status) {
    query = query.eq("status", opts.status);
  }

  const q = opts.q?.trim();
  if (q) {
    const { data: itemMatches } = await admin.from("service_request_items").select("request_id").ilike("product", `%${q}%`);
    const matchingIds = [...new Set((itemMatches ?? []).map((r) => r.request_id as string))];

    const orParts = [
      `client_name.ilike.%${q}%`,
      `client_cpf.ilike.%${q}%`,
      `client_phone.ilike.%${q}%`,
      `order_code.ilike.%${q}%`,
    ];
    if (matchingIds.length > 0) {
      orParts.push(`id.in.(${matchingIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
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
  clientNeighborhood: string | null;
  restrictionNote: string | null;
  notes: string | null;
};

export type RequestEvent = {
  id: string;
  eventType: "created" | "status_changed" | "assigned" | "note_added" | "deadline_approved" | "deadline_rejected";
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
  actorName: string | null;
};

type DetailRow = SummaryRow & {
  client_cpf: string | null;
  client_address: string | null;
  client_neighborhood: string | null;
  restriction_note: string | null;
  notes: string | null;
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
  "id, type, status, store_id, order_code, client_name, client_phone, client_cpf, client_address, client_neighborhood, reason, restriction_note, notes, requested_by_name, requested_deadline, deadline_status, approved_deadline, assembler_name, created_at, updated_at, completed_at, assigned_to, stores(name), requester:profiles!requested_by(full_name), assigned:profiles!assigned_to(full_name), items:service_request_items(id, product, quantity, unit_value, payment_released)";

export async function getRequestDetail(
  profile: Profile,
  id: string
): Promise<{ request: ServiceRequestDetail; events: RequestEvent[] } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("service_requests").select(DETAIL_COLUMNS).eq("id", id).single();

  if (error || !data) return null;
  const row = data as unknown as DetailRow;

  if (profile.role === "gerente" && row.store_id !== profile.storeId) {
    return null;
  }

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
    clientNeighborhood: row.client_neighborhood,
    restrictionNote: row.restriction_note,
    notes: row.notes,
  };

  return { request, events };
}
