import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";

export type PartOrderStatus = "aguardando_peca" | "peca_recebida" | "enviada_ao_cliente" | "encerrado";

export const PART_ORDER_STATUSES: PartOrderStatus[] = [
  "aguardando_peca",
  "peca_recebida",
  "enviada_ao_cliente",
  "encerrado",
];

export function isPartOrderStatus(value: string | undefined | null): value is PartOrderStatus {
  return !!value && (PART_ORDER_STATUSES as string[]).includes(value);
}

export async function listSuppliers(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("suppliers").select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => s.name as string);
}

export type PartOrder = {
  id: string;
  ticketNumber: number;
  serviceRequestId: string | null;
  clientName: string | null;
  clientCpf: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  product: string | null;
  partName: string;
  partCode: string | null;
  color: string | null;
  supplier: string | null;
  representative: string | null;
  requestedBy: string | null;
  status: PartOrderStatus;
  partArrivedAt: string | null;
  sentToClientAt: string | null;
  closedAt: string | null;
  expectedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PartOrderRow = {
  id: string;
  ticket_number: number;
  service_request_id: string | null;
  client_name: string | null;
  client_cpf: string | null;
  client_phone: string | null;
  client_email: string | null;
  product: string | null;
  part_name: string;
  part_code: string | null;
  color: string | null;
  supplier: string | null;
  representative: string | null;
  requested_by: string | null;
  status: PartOrderStatus;
  part_arrived_at: string | null;
  sent_to_client_at: string | null;
  closed_at: string | null;
  expected_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const PART_ORDER_COLUMNS =
  "id, ticket_number, service_request_id, client_name, client_cpf, client_phone, client_email, product, part_name, part_code, color, supplier, representative, requested_by, status, part_arrived_at, sent_to_client_at, closed_at, expected_at, notes, created_at, updated_at";

function toPartOrder(row: PartOrderRow): PartOrder {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    serviceRequestId: row.service_request_id,
    clientName: row.client_name,
    clientCpf: row.client_cpf,
    clientPhone: row.client_phone,
    clientEmail: row.client_email,
    product: row.product,
    partName: row.part_name,
    partCode: row.part_code,
    color: row.color,
    supplier: row.supplier,
    representative: row.representative,
    requestedBy: row.requested_by,
    status: row.status,
    partArrivedAt: row.part_arrived_at,
    sentToClientAt: row.sent_to_client_at,
    closedAt: row.closed_at,
    expectedAt: row.expected_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPartOrders(
  opts: { status?: PartOrderStatus; q?: string; supplier?: string } = {}
): Promise<PartOrder[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("part_orders").select(PART_ORDER_COLUMNS).order("created_at", { ascending: false });

  if (opts.status) {
    query = query.eq("status", opts.status);
  }
  if (opts.supplier) {
    query = query.eq("supplier", opts.supplier);
  }

  const q = opts.q?.trim();
  if (q) {
    const qSafe = sanitizeOrFilterValue(q);
    query = query.or(
      [
        `client_name.ilike.%${qSafe}%`,
        `client_cpf.ilike.%${qSafe}%`,
        `product.ilike.%${qSafe}%`,
        `part_name.ilike.%${qSafe}%`,
        `part_code.ilike.%${qSafe}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as PartOrderRow[]).map(toPartOrder);
}

export async function getPartOrder(id: string): Promise<PartOrder | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("part_orders").select(PART_ORDER_COLUMNS).eq("id", id).single();
  if (error || !data) return null;
  return toPartOrder(data as unknown as PartOrderRow);
}

export async function countPartOrdersOverview(): Promise<{ awaiting: number; readyToSend: number }> {
  const admin = getSupabaseAdmin();
  const [awaitingRes, readyRes] = await Promise.all([
    admin.from("part_orders").select("id", { count: "exact", head: true }).eq("status", "aguardando_peca"),
    admin.from("part_orders").select("id", { count: "exact", head: true }).eq("status", "peca_recebida"),
  ]);
  return { awaiting: awaitingRes.count ?? 0, readyToSend: readyRes.count ?? 0 };
}
