import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";

// "aguardando_resposta" e "cancelada" (pedido do Victor 09/09/2026, planilha
// "Solicitação de peças") -- "aguardando_resposta" é ANTES de
// "aguardando_peca" no fluxo real: fornecedor ainda nem confirmou que vai
// mandar a peça, diferente de "aguardando_peca" (já confirmou, só falta
// chegar). Ver NEXT_STATUSES em PartOrderActions.tsx pra transição entre os
// dois.
export type PartOrderStatus =
  | "aguardando_resposta"
  | "aguardando_peca"
  | "peca_recebida"
  | "enviada_ao_cliente"
  | "encerrado"
  | "cancelada";

export const PART_ORDER_STATUSES: PartOrderStatus[] = [
  "aguardando_resposta",
  "aguardando_peca",
  "peca_recebida",
  "enviada_ao_cliente",
  "encerrado",
  "cancelada",
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
  // Contato do REPRESENTANTE (fornecedor) -- distinto de clientEmail/
  // clientPhone acima, que são do cliente final. Nunca existia antes (pedido
  // do Victor 09/09/2026, planilha "Solicitação de peças").
  representativeEmail: string | null;
  representativePhone: string | null;
  // Tipo do CHAMADO de assistência que originou esse pedido de peça (ex.:
  // "envio_peca", "troca_produto") -- só existe quando serviceRequestId
  // está preenchido (pedido criado a partir de um chamado, ver
  // pecas/nova/page.tsx). Pedidos avulsos (sem chamado por trás, incluindo
  // todo o histórico importado da planilha) ficam null -- pedido do Victor
  // 09/09/2026: "tag colorida... indicando o tipo/status do fluxo (ex:
  // Envio de peça em verde, Troca de produto em laranja)", mesma
  // taxonomia/cor já usada em REQUEST_TYPE_LABELS/DELIVERY_TYPE_COLORS
  // pras entregas, não um tipo novo inventado só pra peças.
  serviceRequestType: string | null;
  // Número original do chamado na planilha "Solicitação de peças"
  // (CH0001..CH1641) -- só preenchido nos pedidos importados do histórico.
  // Pedido do Victor 09/09/2026: mostrar ESSE número em vez do ticket_number
  // novo pra esses casos (ver PecasTable.tsx).
  externalReference: string | null;
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
  representative_email: string | null;
  representative_phone: string | null;
  service_requests: { type: string } | null;
  external_reference: string | null;
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
  "id, ticket_number, service_request_id, client_name, client_cpf, client_phone, client_email, product, part_name, part_code, color, supplier, representative, representative_email, representative_phone, service_requests(type), external_reference, requested_by, status, part_arrived_at, sent_to_client_at, closed_at, expected_at, notes, created_at, updated_at";

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
    representativeEmail: row.representative_email,
    representativePhone: row.representative_phone,
    serviceRequestType: row.service_requests?.type ?? null,
    externalReference: row.external_reference,
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
