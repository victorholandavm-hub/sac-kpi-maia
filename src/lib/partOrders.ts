import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";

// "aguardando_resposta" e "cancelada" (pedido do Victor 09/09/2026, planilha
// "Solicitação de peças") -- "aguardando_resposta" é ANTES de
// "aguardando_peca" no fluxo real: fornecedor ainda nem confirmou que vai
// mandar a peça, diferente de "aguardando_peca" (já confirmou, só falta
// chegar). Ver NEXT_STATUSES em PartOrderActions.tsx pra transição entre os
// dois.
// "devolvida_ao_estoque" (pedido do Victor 14/09/2026, migration 0126) --
// desfecho da peça quando ela chega DEPOIS do caso do cliente já ter sido
// resolvido por outro meio (ver resolvedWithoutPartAt abaixo): em vez de
// "enviada_ao_cliente", volta pro estoque. Status terminal, igual
// encerrado/cancelada.
export type PartOrderStatus =
  | "aguardando_resposta"
  | "aguardando_peca"
  | "peca_recebida"
  | "enviada_ao_cliente"
  | "devolvida_ao_estoque"
  | "encerrado"
  | "cancelada";

export const PART_ORDER_STATUSES: PartOrderStatus[] = [
  "aguardando_resposta",
  "aguardando_peca",
  "peca_recebida",
  "enviada_ao_cliente",
  "devolvida_ao_estoque",
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

export type SupplierContact = { representative: string | null; representativeEmail: string | null; representativePhone: string | null };

// Contato do representante por FORNECEDOR (não por pedido) -- pedido do
// Victor 09/09/2026: preencher sozinho ao escolher o fornecedor num pedido
// novo. Mapa em vez de lista pra o form (client component) já receber
// pronto pra consultar por nome, sem round-trip nenhum ao selecionar (só
// ~49 fornecedores, cabe fácil mandar tudo de uma vez).
export async function listSupplierContacts(): Promise<Record<string, SupplierContact>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("suppliers").select("name, representative, representative_email, representative_phone");
  if (error) throw new Error(error.message);

  const map: Record<string, SupplierContact> = {};
  for (const row of data ?? []) {
    map[row.name as string] = {
      representative: row.representative as string | null,
      representativeEmail: row.representative_email as string | null,
      representativePhone: row.representative_phone as string | null,
    };
  }
  return map;
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
  // Número da nota fiscal -- pedido do Victor 15/09/2026: vai no corpo do
  // e-mail pro representante do fornecedor (ver PartOrderEmailButton.tsx).
  invoiceNumber: string | null;
  // Quando preenchido, o CASO do cliente já foi resolvido por outro meio,
  // sem esperar esta peça -- pedido do Victor 14/09/2026, migration 0126
  // (ver PartOrderActions.tsx). A peça em si continua seu fluxo normal até
  // chegar de verdade; só o desfecho na chegada muda (devolvida_ao_estoque
  // em vez de enviada_ao_cliente).
  resolvedWithoutPartAt: string | null;
  resolvedWithoutPartBy: string | null;
  // LEGADO (migration 0131, 16/09/2026) -- amarrava peças pedidas na mesma
  // submissão em VÁRIOS part_orders (um chamado por peça). Achado do
  // Victor testando de verdade: "por que ficou em três chamados
  // diferentes? era pra ser tudo em um só" -- correto, não é assim que
  // devia funcionar. Substituído por part_order_items (migration 0132,
  // ver PartOrderItem/listPartOrderItems abaixo) -- um chamado só, várias
  // peças DENTRO dele. groupId fica só pra continuar exibindo certo os
  // pouquíssimos chamados já criados com o desenho antigo antes da
  // correção; solicitação nova NUNCA mais grava isso.
  groupId: string | null;
  // Quantas peças em part_order_items além da 1ª (que já mora em
  // partName/partCode/color/product acima) -- 0 = chamado de sempre (1
  // peça só, nenhuma linha em part_order_items, imensa maioria histórica).
  // Ver PartOrderItem/listPartOrderItems abaixo.
  extraItemsCount: number;
  createdAt: string;
  updatedAt: string;
};

// Peças ALÉM da 1ª de um chamado com várias peças (migration 0132,
// 16/09/2026) -- a 1ª peça mora em part_orders.part_name/part_code/color/
// product (ver comentário em PartOrder acima); estas são as extras,
// criadas junto quando a solicitação tinha mais de uma peça (ver
// createPartOrder, pecas-actions.ts).
export type PartOrderItem = {
  id: string;
  partName: string;
  partCode: string | null;
  color: string | null;
  product: string | null;
};

type PartOrderItemRow = {
  id: string;
  part_name: string;
  part_code: string | null;
  color: string | null;
  product: string | null;
};

function toPartOrderItem(row: PartOrderItemRow): PartOrderItem {
  return { id: row.id, partName: row.part_name, partCode: row.part_code, color: row.color, product: row.product };
}

export async function listPartOrderItems(partOrderId: string): Promise<PartOrderItem[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("part_order_items")
    .select("id, part_name, part_code, color, product")
    .eq("part_order_id", partOrderId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PartOrderItemRow[]).map(toPartOrderItem);
}

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
  invoice_number: string | null;
  resolved_without_part_at: string | null;
  resolved_without_part_by: string | null;
  group_id: string | null;
  // Embed de contagem (PostgREST "table(count)") -- vem como array de 1
  // item, {count: N}, mesmo quando N é 0. Usado só pra saber se o chamado
  // tem mais de 1 peça (ver extraItemsCount, PartOrder acima) sem precisar
  // de uma consulta à parte pra cada linha da lista.
  part_order_items: { count: number }[];
  created_at: string;
  updated_at: string;
};

const PART_ORDER_COLUMNS =
  "id, ticket_number, service_request_id, client_name, client_cpf, client_phone, client_email, product, part_name, part_code, color, supplier, representative, representative_email, representative_phone, service_requests(type), external_reference, requested_by, status, part_arrived_at, sent_to_client_at, closed_at, expected_at, notes, invoice_number, resolved_without_part_at, resolved_without_part_by, group_id, part_order_items(count), created_at, updated_at";

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
    invoiceNumber: row.invoice_number,
    resolvedWithoutPartAt: row.resolved_without_part_at,
    resolvedWithoutPartBy: row.resolved_without_part_by,
    groupId: row.group_id,
    extraItemsCount: row.part_order_items?.[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// "Atrasado" (>30 dias desde aberto) / "Entrando em atraso" (20-30 dias) --
// pedido do Victor 17/09/2026: filtro pra achar chamados de peça esquecidos,
// diferente do "atrasado" que já existe por linha (isOverdue em
// PecasTable.tsx, que compara contra expected_at, um prazo manual por
// chamado). Este é baseado só na IDADE do chamado (created_at). Correção
// do mesmo dia (Victor: "quando estiver como peça recebida, não deve
// continuar como em atraso") -- o atraso é em relação ao FORNECEDOR, então
// só faz sentido enquanto o chamado ainda está esperando a peça chegar
// (aguardando_resposta/aguardando_peca). A partir de peca_recebida em
// diante (peça já chegou, resta só o lado interno -- enviar ao cliente,
// encerrar etc.) deixa de contar, mesmo que o chamado continue "aberto".
export type PartOrderAtrasoFilter = "atrasado" | "entrando_em_atraso";

export function isPartOrderAtrasoFilter(value: string | undefined | null): value is PartOrderAtrasoFilter {
  return value === "atrasado" || value === "entrando_em_atraso";
}

const ATRASO_ELIGIBLE_STATUSES: PartOrderStatus[] = ["aguardando_resposta", "aguardando_peca"];

export async function listPartOrders(
  opts: { status?: PartOrderStatus; q?: string; supplier?: string; atraso?: PartOrderAtrasoFilter } = {}
): Promise<PartOrder[]> {
  const admin = getSupabaseAdmin();

  const rows = await fetchAllPagesParallel<PartOrderRow>((from, to) => {
    let query = admin
      .from("part_orders")
      .select(PART_ORDER_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (opts.status) {
      query = query.eq("status", opts.status);
    }
    if (opts.supplier) {
      query = query.eq("supplier", opts.supplier);
    }

    if (opts.atraso) {
      query = query.in("status", ATRASO_ELIGIBLE_STATUSES);
      const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      if (opts.atraso === "atrasado") {
        query = query.lt("created_at", cutoff30);
      } else {
        const cutoff20 = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", cutoff30).lt("created_at", cutoff20);
      }
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

    return query as unknown as PromiseLike<PagedQueryResult<PartOrderRow>>;
  });

  return rows.map(toPartOrder);
}

export async function getPartOrder(id: string): Promise<PartOrder | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("part_orders").select(PART_ORDER_COLUMNS).eq("id", id).single();
  if (error || !data) return null;
  return toPartOrder(data as unknown as PartOrderRow);
}

// Peças-irmãs da mesma solicitação (mesmo group_id) -- pedido do Victor
// 16/09/2026: "adicione a opção de eu adicionar mais de uma peça na mesma
// solicitação, pois... a fábrica manda tudo junto". Usado pra montar um
// e-mail SÓ com todas as peças da solicitação (ver PartOrderEmailButton.tsx)
// e pra mostrar "faz parte de uma solicitação com mais peças" no detalhe.
// Ordenado por criação -- mesma ordem que foram digitadas no formulário.
export async function listPartOrdersByGroupId(groupId: string): Promise<PartOrder[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("part_orders").select(PART_ORDER_COLUMNS).eq("group_id", groupId).order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PartOrderRow[]).map(toPartOrder);
}

export type PartOrderLinkMatch = {
  id: string;
  externalReference: string | null;
  ticketNumber: number;
  clientName: string | null;
  clientCpf: string | null;
  clientPhone: string | null;
  product: string | null;
  partName: string;
  partCode: string | null;
  color: string | null;
  supplier: string | null;
  status: PartOrderStatus;
};

// Vincular um pedido de peça já chegado numa notificação de assistência
// nova -- pedido do Victor 10/09/2026: "quando essa peça chegar... vou
// precisar fazer uma notificação de assistência... teria como... já dar a
// opção de selecionar as informações que estão lá na aba de peças". Busca
// por CPF, código da peça, número CH ou nome do cliente (o pedido citou os
// 4, sem escolher um só -- essa função aceita todos ao mesmo tempo, `q` é
// livre). Só pedidos já CHEGADOS (peca_recebida/enviada_ao_cliente) --
// vincular um que ainda nem chegou não faz sentido nesse fluxo.
export async function searchPartOrdersForLink(q: string): Promise<PartOrderLinkMatch[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const admin = getSupabaseAdmin();
  const qSafe = sanitizeOrFilterValue(trimmed);
  const { data, error } = await admin
    .from("part_orders")
    .select(
      "id, external_reference, ticket_number, client_name, client_cpf, client_phone, product, part_name, part_code, color, supplier, status"
    )
    .in("status", ["peca_recebida", "enviada_ao_cliente"])
    .or(
      [
        `client_cpf.ilike.%${qSafe}%`,
        `client_name.ilike.%${qSafe}%`,
        `part_code.ilike.%${qSafe}%`,
        `external_reference.ilike.%${qSafe}%`,
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    externalReference: row.external_reference as string | null,
    ticketNumber: row.ticket_number as number,
    clientName: row.client_name as string | null,
    clientCpf: row.client_cpf as string | null,
    clientPhone: row.client_phone as string | null,
    product: row.product as string | null,
    partName: row.part_name as string,
    partCode: row.part_code as string | null,
    color: row.color as string | null,
    supplier: row.supplier as string | null,
    status: row.status as PartOrderStatus,
  }));
}

export type PartOrderDateField = "part_arrived_at" | "sent_to_client_at";

// Histórico de edição manual de "Peça chegou em"/"Enviada ao cliente em"
// -- pedido do Victor 14/09/2026 (ver updatePartArrivedAt/
// updateSentToClientAt, pecas-actions.ts, e migration
// 0125_part_order_field_history.sql). Mais recente primeiro -- é log, faz
// sentido ler de trás pra frente (o que mudou por último é o que importa
// primeiro).
export type PartOrderFieldHistoryEntry = {
  id: string;
  field: PartOrderDateField;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedByRole: string;
  changedAt: string;
};

export async function listPartOrderFieldHistory(partOrderId: string): Promise<PartOrderFieldHistoryEntry[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("part_order_field_history")
    .select("id, field, old_value, new_value, changed_by, changed_by_role, changed_at")
    .eq("part_order_id", partOrderId)
    .order("changed_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    field: row.field as PartOrderDateField,
    oldValue: row.old_value as string | null,
    newValue: row.new_value as string | null,
    changedBy: row.changed_by as string,
    changedByRole: row.changed_by_role as string,
    changedAt: row.changed_at as string,
  }));
}

export async function countPartOrdersOverview(): Promise<{ awaiting: number; readyToSend: number }> {
  const admin = getSupabaseAdmin();
  const [awaitingRes, readyRes] = await Promise.all([
    admin.from("part_orders").select("id", { count: "exact", head: true }).eq("status", "aguardando_peca"),
    admin.from("part_orders").select("id", { count: "exact", head: true }).eq("status", "peca_recebida"),
  ]);
  return { awaiting: awaitingRes.count ?? 0, readyToSend: readyRes.count ?? 0 };
}
