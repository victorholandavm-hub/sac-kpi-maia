import { getSupabaseAdmin } from "./supabaseAdmin";
import { notifyLoja, notifyFabrica, notifyCd } from "./notifications";
import { PEDIDO_ENCOMENDA_STATUS_LABELS } from "./assistenciaLabels";
import { findInternalFabrica } from "./fabricas";

export type PedidoEncomendaStatus =
  | "solicitado"
  | "em_producao"
  | "pronto_para_expedicao"
  | "em_carga"
  | "faturado"
  | "entregue"
  | "cancelado"
  | "negado";

export const PEDIDO_ENCOMENDA_STATUSES: PedidoEncomendaStatus[] = [
  "solicitado",
  "em_producao",
  "pronto_para_expedicao",
  "em_carga",
  "faturado",
  "entregue",
  "cancelado",
  "negado",
];

export function isPedidoEncomendaStatus(value: string | undefined | null): value is PedidoEncomendaStatus {
  return !!value && (PEDIDO_ENCOMENDA_STATUSES as string[]).includes(value);
}

// Pedidos ainda não concluídos/cancelados — usado tanto pra filtrar "em
// aberto" quanto pra calcular a posição na fila (ver listOpenPedidoEncomendaQueueIds).
export const OPEN_PEDIDO_ENCOMENDA_STATUSES: PedidoEncomendaStatus[] = [
  "solicitado",
  "em_producao",
  "pronto_para_expedicao",
  "em_carga",
  "faturado",
];

// Ordem real de solicitação entre os pedidos ainda em aberto (mais antigo
// primeiro) — mesmo padrão de listOpenMontagemQueueIds (src/lib/serviceRequests.ts),
// usado pra numerar "Nº na fila" na tela da loja e na fila interna de CD/fábrica.
export async function listOpenPedidoEncomendaQueueIds(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedidos_encomenda")
    .select("id")
    .in("status", OPEN_PEDIDO_ENCOMENDA_STATUSES)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

// Pedidos ainda não iniciados pela fábrica — usado pra badge de contagem na
// aba "Encomendas" da navegação (mesmo espírito de countRequestsOverview em
// serviceRequests.ts).
export async function countPedidosEncomendaSolicitados(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("pedidos_encomenda")
    .select("id", { count: "exact", head: true })
    .eq("status", "solicitado");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type ProdutoEncomenda = {
  id: string;
  descricao: string;
  categoria: string | null;
  ativo: boolean;
};

export async function listProdutosEncomenda(opts: { onlyActive?: boolean } = {}): Promise<ProdutoEncomenda[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("produtos_encomenda").select("id, descricao, categoria, ativo").order("descricao");
  if (opts.onlyActive) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Cadastra um produto novo, ou reativa/atualiza a categoria de um já existente
// com a mesma descrição — mesmo padrão de upsert-por-nome usado em
// assemblers/drivers/suppliers.
export async function upsertProdutoEncomenda(descricao: string, categoria: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("produtos_encomenda")
    .upsert({ descricao, categoria, ativo: true }, { onConflict: "descricao" });
  if (error) throw new Error(error.message);
}

export async function setProdutoEncomendaAtivo(id: string, ativo: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("produtos_encomenda").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
}

export type PedidoEncomendaItem = {
  id: string;
  produtoDescricao: string;
  produtoCodigo: string | null;
  quantidade: number;
};

export type PedidoEncomendaSummary = {
  id: string;
  pedidoNumber: number;
  storeId: string;
  storeName: string;
  status: PedidoEncomendaStatus;
  carga: string | null;
  nfE: string | null;
  requestedByName: string;
  vendedorName: string | null;
  clienteCodigo: string | null;
  prazoFabricaCd: string | null;
  prazoCdLoja: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PedidoEncomendaItem[];
  fornecedorTipo: "fabrica_interna" | "fabrica_externa";
  fabricaId: string | null;
  fabricaNome: string | null;
  fornecedorExterno: string | null;
};

type PedidoRow = {
  id: string;
  pedido_number: number;
  store_id: string;
  status: PedidoEncomendaStatus;
  carga: string | null;
  nf_e: string | null;
  requested_by_name: string;
  vendedor_name: string | null;
  cliente_codigo: string | null;
  prazo_fabrica_cd: string | null;
  prazo_cd_loja: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stores: { name: string } | null;
  fornecedor_tipo: "fabrica_interna" | "fabrica_externa";
  fabrica_id: string | null;
  fornecedor_externo: string | null;
  fabricas: { nome: string } | null;
  pedido_encomenda_itens:
    | {
        id: string;
        quantidade: number;
        produto_descricao: string | null;
        produto_codigo: string | null;
        produtos_encomenda: { descricao: string } | null;
      }[]
    | null;
};

const PEDIDO_COLUMNS =
  "id, pedido_number, store_id, status, carga, nf_e, requested_by_name, vendedor_name, cliente_codigo, prazo_fabrica_cd, prazo_cd_loja, notes, created_at, updated_at, stores(name), fornecedor_tipo, fabrica_id, fornecedor_externo, fabricas(nome), pedido_encomenda_itens(id, quantidade, produto_descricao, produto_codigo, produtos_encomenda(descricao))";

function toSummary(row: PedidoRow): PedidoEncomendaSummary {
  return {
    id: row.id,
    pedidoNumber: row.pedido_number,
    storeId: row.store_id,
    storeName: row.stores?.name ?? row.store_id,
    status: row.status,
    carga: row.carga,
    nfE: row.nf_e,
    requestedByName: row.requested_by_name,
    vendedorName: row.vendedor_name,
    clienteCodigo: row.cliente_codigo,
    prazoFabricaCd: row.prazo_fabrica_cd,
    prazoCdLoja: row.prazo_cd_loja,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.pedido_encomenda_itens ?? []).map((i) => ({
      id: i.id,
      produtoDescricao: i.produto_descricao ?? i.produtos_encomenda?.descricao ?? "Produto removido",
      produtoCodigo: i.produto_codigo,
      quantidade: i.quantidade,
    })),
    fornecedorTipo: row.fornecedor_tipo,
    fabricaId: row.fabrica_id,
    fabricaNome: row.fabricas?.nome ?? null,
    fornecedorExterno: row.fornecedor_externo,
  };
}

export async function listPedidosByStores(
  storeIds: string[],
  opts: { onlyOpen?: boolean } = {}
): Promise<PedidoEncomendaSummary[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  let query = admin.from("pedidos_encomenda").select(PEDIDO_COLUMNS).in("store_id", storeIds);
  if (opts.onlyOpen) query = query.not("status", "in", "(entregue,cancelado,negado)");
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PedidoRow[]).map(toSummary);
}

// SAC não tem loja fixa (ver EncomendaRequester em encomendaRequester.ts) --
// acompanha os pedidos que ele mesmo lançou, não por loja como caixa/gerente
// (ver listPedidosByStores acima). Mesmo padrão de uso: tela sem sessão
// Supabase Auth própria pra fila interna, então busca tudo de uma vez.
export async function listPedidosByRequester(requestedByName: string): Promise<PedidoEncomendaSummary[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedidos_encomenda")
    .select(PEDIDO_COLUMNS)
    .eq("requested_by_name", requestedByName)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PedidoRow[]).map(toSummary);
}

export async function listAllPedidos(
  opts: {
    status?: PedidoEncomendaStatus;
    // Fila principal (fila/page.tsx): por padrão só mostra os pedidos ainda
    // em andamento, senão entregue/cancelado/negado antigo (bem mais
    // numeroso com o tempo) enche a tela e empurra pra baixo o que
    // realmente precisa de ação -- ignorado se `status` também for passado.
    onlyOpen?: boolean;
    storeId?: string;
    fabricaId?: string;
    fornecedorTipo?: "fabrica_interna" | "fabrica_externa";
  } = {}
): Promise<PedidoEncomendaSummary[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("pedidos_encomenda").select(PEDIDO_COLUMNS);
  if (opts.status) {
    query = query.eq("status", opts.status);
  } else if (opts.onlyOpen) {
    query = query.in("status", OPEN_PEDIDO_ENCOMENDA_STATUSES);
  }
  if (opts.storeId) query = query.eq("store_id", opts.storeId);
  // Operador de fábrica só enxerga pedidos da própria fábrica -- nunca
  // externos, nunca da outra fábrica interna (ver fila/page.tsx).
  if (opts.fabricaId) query = query.eq("fabrica_id", opts.fabricaId);
  if (opts.fornecedorTipo) query = query.eq("fornecedor_tipo", opts.fornecedorTipo);
  // Ascendente (mais antigo primeiro) -- é literalmente a fila (FIFO), e o
  // número "Nº na fila" (ver listOpenPedidoEncomendaQueueIds) já segue essa
  // ordem. Com ordem descendente aqui, a lista mostrava o 2º antes do 1º.
  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PedidoRow[]).map(toSummary);
}

export type PedidoEncomendaEvent = {
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

// Timeline de vários pedidos numa query só — usado pela tela da caixa
// (/assistencia/encomendas/caixa), que não tem sessão do Supabase Auth e por
// isso não pode acessar a tela interna da fila (essa sim, uma consulta por vez).
export async function listEventsForPedidos(pedidoIds: string[]): Promise<Map<string, PedidoEncomendaEvent[]>> {
  const map = new Map<string, PedidoEncomendaEvent[]>();
  if (pedidoIds.length === 0) return map;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedido_encomenda_events")
    .select("id, pedido_id, actor_name, actor_role, event_type, from_status, to_status, note, created_at")
    .in("pedido_id", pedidoIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as (EventRow & { pedido_id: string })[]) {
    const event: PedidoEncomendaEvent = {
      id: row.id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      eventType: row.event_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      note: row.note,
      createdAt: row.created_at,
    };
    const list = map.get(row.pedido_id);
    if (list) list.push(event);
    else map.set(row.pedido_id, [event]);
  }

  return map;
}

export async function getPedidoDetail(
  id: string
): Promise<{ pedido: PedidoEncomendaSummary; events: PedidoEncomendaEvent[] } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("pedidos_encomenda").select(PEDIDO_COLUMNS).eq("id", id).single();
  if (error || !data) return null;

  const { data: eventRows } = await admin
    .from("pedido_encomenda_events")
    .select("id, actor_name, actor_role, event_type, from_status, to_status, note, created_at")
    .eq("pedido_id", id)
    .order("created_at", { ascending: true });

  const events: PedidoEncomendaEvent[] = ((eventRows ?? []) as unknown as EventRow[]).map((e) => ({
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

export type NewPedidoEncomendaItem = { produtoDescricao: string; produtoCodigo: string | null; quantidade: number };

// Cria o pedido + itens + evento "created" numa sequência só. Se a inserção
// dos itens falhar depois do cabeçalho já ter sido criado, o pedido fica sem
// item (visível na fila pra alguém corrigir) em vez de silenciosamente
// desaparecer — não há transação entre as duas chamadas porque o client
// admin do Supabase (PostgREST) não expõe transações multi-tabela.
export async function createPedidoEncomenda(input: {
  storeId: string;
  requestedByName: string;
  requesterRole: string;
  vendedorName: string | null;
  clienteCodigo: string | null;
  notes: string | null;
  items: NewPedidoEncomendaItem[];
  fornecedorTipo: "fabrica_interna" | "fabrica_externa";
  fabricaId: string | null;
  fornecedorExterno: string | null;
}): Promise<{ id: string; pedidoNumber: number }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("pedidos_encomenda")
    .insert({
      store_id: input.storeId,
      requested_by_name: input.requestedByName,
      vendedor_name: input.vendedorName,
      cliente_codigo: input.clienteCodigo,
      notes: input.notes,
      fornecedor_tipo: input.fornecedorTipo,
      fabrica_id: input.fabricaId,
      fornecedor_externo: input.fornecedorExterno,
    })
    .select("id, pedido_number")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar o pedido.");
  }

  const { error: itemsError } = await admin
    .from("pedido_encomenda_itens")
    .insert(
      input.items.map((item) => ({
        pedido_id: data.id,
        produto_descricao: item.produtoDescricao,
        produto_codigo: item.produtoCodigo,
        quantidade: item.quantidade,
      }))
    );
  if (itemsError) {
    throw new Error(`Pedido criado, mas falhou ao salvar os itens: ${itemsError.message}`);
  }

  await admin.from("pedido_encomenda_events").insert({
    pedido_id: data.id,
    actor_name: input.requestedByName,
    actor_role: input.requesterRole,
    event_type: "created",
    to_status: "solicitado",
  });

  const title = `Novo pedido #${data.pedido_number} pra produzir`;
  const message = `${input.items.length} ite${input.items.length === 1 ? "m" : "ns"} · pedido por ${input.requestedByName}`;
  const link = `/assistencia/encomendas/fila/${data.id}`;
  // CD acompanha a fila inteira (interna + externa, ver encomendas/fila/page.tsx
  // sem filtro por padrão) -- recebe notificação de todo pedido novo, não só
  // dos externos que ele mesmo trata diretamente.
  await notifyCd({ type: "novo_pedido", title, message, link });
  if (input.fornecedorTipo === "fabrica_interna" && input.fabricaId) {
    await notifyFabrica(input.fabricaId, { type: "novo_pedido", title, message, link });
  }

  return { id: data.id, pedidoNumber: data.pedido_number };
}

// Solicitante corrige o próprio pedido (produto errado, esqueceu o código do
// cliente etc.) em vez de criar um novo do zero -- é exatamente esse
// segundo caminho que gerava pedido duplicado. Só faz sentido enquanto
// ninguém do outro lado (fábrica/CD) mexeu ainda -- a autorização de quem
// pode chamar isso e até que status fica em requireEncomendaEdit (dal.ts),
// aqui só executa a troca. Não mexe em loja/fornecedor -- pedido errado
// nesses campos é pra cancelar e lançar de novo, não editar.
export async function updatePedidoEncomendaContent(
  id: string,
  input: {
    vendedorName: string | null;
    clienteCodigo: string | null;
    notes: string | null;
    items: NewPedidoEncomendaItem[];
  },
  actor: { name: string; role: string }
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error: updateError } = await admin
    .from("pedidos_encomenda")
    .update({
      vendedor_name: input.vendedorName,
      cliente_codigo: input.clienteCodigo,
      notes: input.notes,
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await admin.from("pedido_encomenda_itens").delete().eq("pedido_id", id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: itemsError } = await admin.from("pedido_encomenda_itens").insert(
    input.items.map((item) => ({
      pedido_id: id,
      produto_descricao: item.produtoDescricao,
      produto_codigo: item.produtoCodigo,
      quantidade: item.quantidade,
    }))
  );
  if (itemsError) throw new Error(`Itens não foram salvos: ${itemsError.message}`);

  await admin.from("pedido_encomenda_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "edited",
  });
}

export async function updatePedidoStatus(
  id: string,
  actor: { name: string; role: string },
  fromStatus: string,
  toStatus: PedidoEncomendaStatus,
  opts: { carga?: string; nfE?: string; note?: string } = {}
): Promise<void> {
  const admin = getSupabaseAdmin();

  const patch: Record<string, string> = { status: toStatus };
  if (opts.carga) patch.carga = opts.carga;
  if (opts.nfE) patch.nf_e = opts.nfE;

  // Trava pelo status que a tela viu (fromStatus) -- sem isso, duas pessoas
  // agindo quase ao mesmo tempo no mesmo pedido (ex: CD avança pra "em_carga"
  // enquanto admin cancela) gravam por cima uma da outra silenciosamente,
  // sem erro nem aviso pra quem perdeu a corrida.
  const { data, error } = await admin
    .from("pedidos_encomenda")
    .update(patch)
    .eq("id", id)
    .eq("status", fromStatus)
    .select("id, pedido_number, store_id, fabrica_id, fornecedor_tipo")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Esse pedido já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");
  }

  const eventType = opts.carga ? "carga_informada" : opts.nfE ? "nf_e_informada" : "status_changed";
  const noteParts: string[] = [];
  if (opts.carga) noteParts.push(`Carga: ${opts.carga}`);
  if (opts.nfE) noteParts.push(`NF-e: ${opts.nfE}`);
  const note = noteParts.length > 0 ? noteParts.join(" · ") : opts.note?.trim() || null;

  await admin.from("pedido_encomenda_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    note,
  });

  const link = `/assistencia/encomendas/fila/${id}`;
  const statusLabel = PEDIDO_ENCOMENDA_STATUS_LABELS[toStatus] ?? toStatus;
  const title = `Pedido #${data.pedido_number}: ${statusLabel}`;
  await notifyLoja(data.store_id, { type: "status_changed", title, message: note, link });
  if (data.fornecedor_tipo === "fabrica_interna" && data.fabrica_id) {
    await notifyFabrica(data.fabrica_id, { type: "status_changed", title, message: note, link });
  }
}

// Correção de fornecedor errado (ex.: pedido lançado pra Beds/Aiam Estofados
// quando devia ser Colchões, ou fábrica própria quando devia ser fornecedor
// externo) -- só enquanto "solicitado", antes de qualquer fábrica começar a
// produzir (mesma janela de updatePedidoEncomendaContent). Existe pra evitar
// o caminho de negar o pedido + loja relançar do zero reanexando cupom
// fiscal etc. Quem pode chamar isso é decidido em updatePedidoFornecedorAction
// (encomendas-actions.ts) -- aqui só executa a troca.
export async function updatePedidoFornecedor(
  id: string,
  actor: { name: string; role: string },
  input: { fornecedorTipo: "fabrica_interna" | "fabrica_externa"; fabricaId: string | null; fornecedorExterno: string | null }
): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status, fornecedor_tipo, fabrica_id, fornecedor_externo")
    .eq("id", id)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");
  if (current.status !== "solicitado") {
    throw new Error('Só é possível corrigir o fornecedor enquanto o pedido está "solicitado".');
  }
  if (
    current.fornecedor_tipo === input.fornecedorTipo &&
    current.fabrica_id === input.fabricaId &&
    current.fornecedor_externo === input.fornecedorExterno
  ) {
    throw new Error("Selecione um fornecedor diferente do atual.");
  }

  // Trava pelo status "solicitado" -- mesma razão do guard em
  // updatePedidoStatus: se a fábrica/CD começar a mexer no pedido bem nesse
  // instante, a correção não deve gravar por cima silenciosamente.
  const { data, error } = await admin
    .from("pedidos_encomenda")
    .update({ fornecedor_tipo: input.fornecedorTipo, fabrica_id: input.fabricaId, fornecedor_externo: input.fornecedorExterno })
    .eq("id", id)
    .eq("status", "solicitado")
    .select("id, pedido_number, store_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Esse pedido já foi atualizado por outra pessoa. Recarregue a página e tente de novo.");
  }

  const fromLabel = current.fornecedor_tipo === "fabrica_externa" ? current.fornecedor_externo : findInternalFabrica(current.fabrica_id)?.nome;
  const toLabel = input.fornecedorTipo === "fabrica_externa" ? input.fornecedorExterno : findInternalFabrica(input.fabricaId)?.nome;
  const note = `${fromLabel ?? "?"} → ${toLabel ?? "?"}`;

  await admin.from("pedido_encomenda_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "fornecedor_changed",
    note,
  });

  const link = `/assistencia/encomendas/fila/${id}`;
  const title = `Pedido #${data.pedido_number}: fornecedor corrigido`;
  await notifyLoja(data.store_id, { type: "fornecedor_changed", title, message: note, link });
  if (input.fornecedorTipo === "fabrica_interna" && input.fabricaId) {
    await notifyFabrica(input.fabricaId, {
      type: "novo_pedido",
      title: `Pedido #${data.pedido_number} pra produzir`,
      message: note,
      link,
    });
  }
}

// Prazo por etapa -- obrigatório na transição em que é definido pela primeira
// vez (ver advancePedidoStatus), mas continua editável depois disso (só quem
// é dono daquela etapa, ou admin/assistência, ver as actions).
export async function setPedidoPrazoEtapa(
  id: string,
  actor: { name: string; role: string },
  field: "prazo_fabrica_cd" | "prazo_cd_loja",
  value: string
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedidos_encomenda")
    .update({ [field]: value })
    .eq("id", id)
    .select("pedido_number, store_id")
    .single();
  if (error) throw new Error(error.message);

  const label = field === "prazo_fabrica_cd" ? "Prazo fábrica → CD" : "Prazo CD → loja";
  const note = `${label}: ${new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR")}`;
  const { error: eventError } = await admin.from("pedido_encomenda_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "prazo_definido",
    note,
  });
  if (eventError) throw new Error(eventError.message);

  await notifyLoja(data.store_id, {
    type: "prazo_changed",
    title: `Pedido #${data.pedido_number}: novo prazo`,
    message: note,
    link: `/assistencia/encomendas/fila/${id}`,
  });
}

export async function addPedidoNote(id: string, actor: { name: string; role: string }, note: string): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("pedido_encomenda_events").insert({
    pedido_id: id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "note_added",
    note: trimmed,
  });
  if (error) throw new Error(error.message);
}
