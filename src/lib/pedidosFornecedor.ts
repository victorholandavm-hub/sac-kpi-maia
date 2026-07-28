import { getSupabaseAdmin } from "./supabaseAdmin";

export type PedidoFornecedorStatus = "pedido_feito" | "recebido" | "cancelado";

export const PEDIDO_FORNECEDOR_STATUSES: PedidoFornecedorStatus[] = ["pedido_feito", "recebido", "cancelado"];

export function isPedidoFornecedorStatus(value: string | undefined | null): value is PedidoFornecedorStatus {
  return !!value && (PEDIDO_FORNECEDOR_STATUSES as string[]).includes(value);
}

// Único status "em aberto" -- recebido/cancelado são terminais, sem etapa
// intermediária de produção (fornecedor externo não usa este sistema).
export const OPEN_PEDIDO_FORNECEDOR_STATUSES: PedidoFornecedorStatus[] = ["pedido_feito"];

export type PedidoFornecedorItem = {
  id: string;
  produtoDescricao: string;
  quantidade: number;
};

export type PedidoFornecedorSummary = {
  id: string;
  pedidoNumber: number;
  fornecedor: string;
  status: PedidoFornecedorStatus;
  requestedByName: string;
  expectedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PedidoFornecedorItem[];
};

type PedidoRow = {
  id: string;
  pedido_number: number;
  fornecedor: string;
  status: PedidoFornecedorStatus;
  requested_by_name: string;
  expected_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  pedido_fornecedor_itens: { id: string; produto_descricao: string; quantidade: number }[] | null;
};

const PEDIDO_COLUMNS =
  "id, pedido_number, fornecedor, status, requested_by_name, expected_at, notes, created_at, updated_at, pedido_fornecedor_itens(id, produto_descricao, quantidade)";

function toSummary(row: PedidoRow): PedidoFornecedorSummary {
  return {
    id: row.id,
    pedidoNumber: row.pedido_number,
    fornecedor: row.fornecedor,
    status: row.status,
    requestedByName: row.requested_by_name,
    expectedAt: row.expected_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.pedido_fornecedor_itens ?? []).map((i) => ({
      id: i.id,
      produtoDescricao: i.produto_descricao,
      quantidade: i.quantidade,
    })),
  };
}

export async function listPedidosFornecedor(
  opts: { status?: PedidoFornecedorStatus; fornecedor?: string } = {}
): Promise<PedidoFornecedorSummary[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("pedidos_fornecedor").select(PEDIDO_COLUMNS);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.fornecedor) query = query.eq("fornecedor", opts.fornecedor);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PedidoRow[]).map(toSummary);
}

export type PedidoFornecedorEvent = {
  id: string;
  actorName: string;
  actorRole: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
};

type EventRow = {
  id: string;
  actor_name: string;
  actor_role: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

export async function getPedidoFornecedorDetail(
  id: string
): Promise<{ pedido: PedidoFornecedorSummary; events: PedidoFornecedorEvent[] } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("pedidos_fornecedor").select(PEDIDO_COLUMNS).eq("id", id).single();
  if (error || !data) return null;

  const { data: eventRows } = await admin
    .from("pedido_fornecedor_events")
    .select("id, actor_name, actor_role, event_type, from_status, to_status, note, created_at")
    .eq("pedido_id", id)
    .order("created_at", { ascending: true });

  const events: PedidoFornecedorEvent[] = ((eventRows ?? []) as unknown as EventRow[]).map((e) => ({
    id: e.id,
    actorName: e.actor_name,
    actorRole: e.actor_role,
    eventType: e.event_type,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    note: e.note,
    createdAt: e.created_at,
  }));

  return { pedido: toSummary(data as unknown as PedidoRow), events };
}

export type NewPedidoFornecedorItem = { produtoDescricao: string; quantidade: number };

export async function createPedidoFornecedor(input: {
  fornecedor: string;
  requestedByName: string;
  expectedAt: string | null;
  notes: string | null;
  items: NewPedidoFornecedorItem[];
}): Promise<{ id: string; pedidoNumber: number }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("pedidos_fornecedor")
    .insert({
      fornecedor: input.fornecedor,
      requested_by_name: input.requestedByName,
      expected_at: input.expectedAt,
      notes: input.notes,
    })
    .select("id, pedido_number")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar o pedido.");
  }

  const { error: itemsError } = await admin
    .from("pedido_fornecedor_itens")
    .insert(input.items.map((item) => ({ pedido_id: data.id, produto_descricao: item.produtoDescricao, quantidade: item.quantidade })));
  if (itemsError) {
    throw new Error(`Pedido criado, mas falhou ao salvar os itens: ${itemsError.message}`);
  }

  await admin.from("pedido_fornecedor_events").insert({
    pedido_id: data.id,
    actor_name: input.requestedByName,
    actor_role: "cd",
    event_type: "created",
    to_status: "pedido_feito",
  });

  return { id: data.id, pedidoNumber: data.pedido_number };
}

export async function updatePedidoFornecedorStatus(
  id: string,
  actor: { name: string; role: string },
  fromStatus: string,
  toStatus: PedidoFornecedorStatus,
  opts: { note?: string } = {}
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.from("pedidos_fornecedor").update({ status: toStatus }).eq("id", id);
  if (error) throw new Error(error.message);

  await admin.from("pedido_fornecedor_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "status_changed",
    from_status: fromStatus,
    to_status: toStatus,
    note: opts.note?.trim() || null,
  });
}

export async function setPedidoFornecedorExpectedAt(
  id: string,
  actor: { name: string; role: string },
  expectedAt: string | null
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("pedidos_fornecedor").update({ expected_at: expectedAt }).eq("id", id);
  if (error) throw new Error(error.message);

  const note = expectedAt
    ? `Previsão de chegada: ${new Date(`${expectedAt}T00:00:00`).toLocaleDateString("pt-BR")}`
    : "Previsão de chegada removida.";
  const { error: eventError } = await admin.from("pedido_fornecedor_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "expected_at_changed",
    note,
  });
  if (eventError) throw new Error(eventError.message);
}

export async function addPedidoFornecedorNote(id: string, actor: { name: string; role: string }, note: string): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("pedido_fornecedor_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "note_added",
    note: trimmed,
  });
  if (error) throw new Error(error.message);
}

export async function countPedidosFornecedorOverview(): Promise<{ abertos: number; atrasados: number }> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [abertosRes, atrasadosRes] = await Promise.all([
    admin.from("pedidos_fornecedor").select("id", { count: "exact", head: true }).eq("status", "pedido_feito"),
    admin
      .from("pedidos_fornecedor")
      .select("id", { count: "exact", head: true })
      .eq("status", "pedido_feito")
      .lt("expected_at", today),
  ]);

  return { abertos: abertosRes.count ?? 0, atrasados: atrasadosRes.count ?? 0 };
}
