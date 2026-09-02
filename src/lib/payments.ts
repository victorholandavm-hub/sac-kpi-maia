import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashPin } from "./montadorAuth";
import { isMostruarioRequest, type RequestType } from "./serviceRequests";
import { sanitizeOrFilterValue } from "./searchFilter";

// Cacheado 60s -- mesmo motivo/pedido de listStores (serviceRequests.ts):
// lista de referência que quase nunca muda, mas era buscada do zero (com
// a latência de rede real da VPS até o Supabase) em toda troca de tela.
export const listAssemblers = unstable_cache(
  async (): Promise<string[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("assemblers").select("name").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => a.name as string);
  },
  ["list-assemblers"],
  { revalidate: 60 }
);

// A assistência só gerencia os montadores da região dela -- o resto (Bayeux,
// Santa Rita etc.) é de unidades do interior, cada uma com sua própria
// gestão, fora do alcance daqui. Não tem uma coluna própria pra isso na
// tabela assemblers, mas o nome já entrega: todo montador de unidade do
// interior tem um código de 3 dígitos da loja no final ("GERSON 214",
// "DEDE216"), enquanto os da assistência não têm nada depois do nome
// ("Eduardo", "Manoel"). Usado pra não poluir o Kanban da agenda
// (ver AgendaKanbanBoard.tsx) com colunas de gente que a assistência nunca
// vai atribuir chamado nenhum.
export function isAssistenciaControlledAssembler(name: string): boolean {
  return !/\d{3}\s*$/.test(name.trim());
}

// Montadores da(s) loja(s) informada(s) + os globais/legado (store_id nulo)
// -- usado pra sugerir montador na criação de solicitação de uma loja
// específica (src/app/assistencia/(app)/[id]/page.tsx, nova-rapida).
export async function listAssemblersForStores(storeIds: string[]): Promise<string[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  // Sanitiza antes de colar na string do .or() -- blindagem defensiva
  // (revisão de segurança 26/08/2026): hoje `storeIds` sempre vem de fonte
  // confiável (registro já gravado no banco, ou sessão do gerente via
  // getGerenteStoreIds), não é explorável agora, mas o padrão em si é
  // frágil -- se um dia um chamador passar valor cru vindo de
  // searchParams/formData sem validar, vira injeção de filtro (mesmo
  // raciocínio de searchFilter.ts).
  const safeIds = storeIds.map(sanitizeOrFilterValue);
  const { data, error } = await admin
    .from("assemblers")
    .select("name")
    .or(`store_id.in.(${safeIds.join(",")}),store_id.is.null`)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => a.name as string);
}

// Montador(es) da própria loja (Mamanguape/Campina Grande hoje, mas não
// travado nesses dois -- qualquer loja com montador próprio cai aqui) --
// usado pra deixar o GERENTE da loja (não a assistência) escolher e editar
// quem vai montar, sem depender de ninguém da central atribuir. Duas formas
// de reconhecer "é dessa loja": store_id certo (cadastro novo via "Equipe da
// loja", ver addAssemblerForStore) ou o nome termina com o código da loja
// (cadastro antigo, sempre feito assim -- "GERSON 214", "DEDE216" -- mesma
// convenção de isAssistenciaControlledAssembler acima). Nunca inclui os
// globais/legado (store_id nulo sem o código no nome) -- esses são só do
// pool da central.
export async function listOwnStoreAssemblers(storeId: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name, store_id").order("name");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((a) => a.store_id === storeId || (a.store_id === null && (a.name as string).trim().endsWith(storeId)))
    .map((a) => a.name as string);
}

// Cadastro em um passo só: gerente já define o PIN na hora e repassa pro
// montador (diferente do fluxo admin em admin-actions.ts, que separa criar
// de definir PIN em duas ações).
export async function addAssemblerForStore(name: string, storeId: string, pin: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("assemblers").insert({ name, store_id: storeId, pin_hash: hashPin(pin) });
  if (error) throw new Error(error.message);
}

export type AssemblerWithStoreId = { name: string; storeId: string | null };

// Todos os montadores (qualquer loja + globais), com o store_id de cada um
// -- usado em telas onde a loja só é escolhida depois, no próprio
// formulário (nova-rapida), então o filtro por loja acontece no cliente.
export async function listAllAssemblersWithStoreId(): Promise<AssemblerWithStoreId[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name, store_id").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ name: a.name as string, storeId: a.store_id as string | null }));
}

export type AssemblerForStoreDisplay = { name: string; storeId: string | null; storeName: string | null };

// Pra tela "Equipe da loja" do gerente: mostra os montadores da(s) loja(s)
// dele + os globais/legado, com o nome da loja pra diferenciar visualmente
// os dois grupos.
export async function listAssemblersForStoresWithStoreName(storeIds: string[]): Promise<AssemblerForStoreDisplay[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  // Ver comentário equivalente em listAssemblersForStores acima.
  const safeIds = storeIds.map(sanitizeOrFilterValue);
  const { data, error } = await admin
    .from("assemblers")
    .select("name, store_id, stores(name)")
    .or(`store_id.in.(${safeIds.join(",")}),store_id.is.null`)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { name: string; store_id: string | null; stores: { name: string } | null }[]).map((a) => ({
    name: a.name,
    storeId: a.store_id,
    storeName: a.stores?.name ?? null,
  }));
}

export type AssemblerWithPinStatus = { name: string; hasPin: boolean };

export async function listAssemblersWithPinStatus(): Promise<AssemblerWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ name: a.name as string, hasPin: !!a.pin_hash }));
}

// Cacheado 60s -- mesmo motivo de listAssemblers acima.
export const listDrivers = unstable_cache(
  async (): Promise<string[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("drivers").select("name").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => d.name as string);
  },
  ["list-drivers"],
  { revalidate: 60 }
);

export type DriverWithPinStatus = { name: string; hasPin: boolean };

export async function listDriversWithPinStatus(): Promise<DriverWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("drivers").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({ name: d.name as string, hasPin: !!d.pin_hash }));
}

// "name" é a PK exata da tabela — sem isso, digitar "joão" quando o motorista
// já está cadastrado como "João" cria uma linha duplicada, e o chamado some
// da rota dele (o login por PIN casa por nome sem diferenciar maiúscula, mas
// a busca de chamados do motorista usa o nome exato). Sempre resolve pro nome
// já cadastrado (se existir) antes de gravar.
export async function resolveDriverName(typedName: string): Promise<string> {
  const trimmed = typedName.trim();
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("drivers").select("name");
  const existing = (data ?? []).find((d) => (d.name as string).toLowerCase() === trimmed.toLowerCase());
  return existing?.name ?? trimmed;
}

// Estágio do pagamento de um item — só vira "pendente" (esperando liberação
// do gerente) depois que a montagem em si foi concluída; antes disso é só
// "a_montar", mesmo que o valor já tenha sido definido antecipadamente.
export type PaymentStage = "a_montar" | "pendente" | "liberado";

export function paymentStage(requestStatus: string, paymentReleased: boolean): PaymentStage {
  if (paymentReleased) return "liberado";
  if (requestStatus !== "concluida") return "a_montar";
  return "pendente";
}

export type PaymentItem = {
  itemId: string;
  requestId: string;
  // Só pro Relatório de montagem detalhado (pedido do Victor 29/08/2026)
  // conseguir mostrar o número do chamado -- é o identificador que todo
  // mundo já usa pra achar/conferir uma solicitação em qualquer outra tela
  // (ex.: "#4995"), bem mais fácil de procurar do que o UUID de requestId.
  ticketNumber: number;
  // Também pro Relatório de montagem detalhado -- achado 29/08/2026:
  // service_request_items não é exclusivo de montagem/desmontagem (troca/
  // entrega de produto, envio/recolhimento de peça também têm itens, só
  // não costumam ter unit_value definido). Com includeNoValue:true (que
  // esse relatório usa), os itens dos outros tipos passavam a aparecer
  // junto -- sem o `type` aqui não dava pra filtrar só montagem/
  // desmontagem depois de buscar.
  type: RequestType;
  requestStatus: string;
  product: string;
  quantity: number;
  unitValue: number | null;
  paymentReleased: boolean;
  paymentReleasedAt: string | null;
  paymentAuthorizedBy: string | null;
  assemblerName: string | null;
  clientName: string | null;
  // Só pra aplicar o filtro mostruário x cliente (ver isMostruarioRequest)
  // -- achado do Victor 24/08/2026: "quando filtrar, o numero de
  // solicitações, total a pagar a montadores, pago e penente de liberação
  // deve ser filtrado" também, não só o relatório principal.
  orderCode: string | null;
  storeName: string;
  createdAt: string;
};

type PaymentItemRow = {
  id: string;
  product: string;
  quantity: number;
  unit_value: number | null;
  payment_released: boolean;
  payment_released_at: string | null;
  payment_authorized_by: string | null;
  request: {
    id: string;
    ticket_number: number;
    type: RequestType;
    status: string;
    assembler_name: string | null;
    client_name: string | null;
    order_code: string | null;
    created_at: string;
    stores: { name: string } | null;
  } | null;
};

export async function listPaymentItems(
  opts: {
    assemblerName?: string;
    dateFrom?: string;
    dateTo?: string;
    includeNoValue?: boolean;
    // Mesmo filtro mostruário x cliente da tela de relatórios (ver
    // isMostruarioRequest/ALVO_FILTERS em relatorios/page.tsx) -- pedido
    // do Victor 24/08/2026: sem isso, o total a pagar/pago/pendente de
    // montador não respeitava o filtro escolhido na tela.
    alvo?: "mostruario" | "cliente";
  } = {}
): Promise<PaymentItem[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("service_request_items")
    .select(
      "id, product, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, request:service_requests(id, ticket_number, type, status, assembler_name, client_name, order_code, created_at, stores(name))"
    )
    .order("created_at", { ascending: false });
  // Visão geral (sem montador escolhido) só mostra quem já tem valor --
  // senão a lista fica poluída com anos de item sem preço nenhum. Ao
  // escolher um montador específico (ver pagamentos/page.tsx), o Antonio
  // quer exatamente o contrário: ver tudo dessa pessoa, inclusive o que
  // ainda não tem valor, pra já definir ali mesmo sem entrar em cada
  // solicitação.
  if (!opts.includeNoValue) {
    query = query.not("unit_value", "is", null);
  }
  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as PaymentItemRow[])
    .filter((row) => row.request !== null)
    .map((row) => ({
      itemId: row.id,
      requestId: row.request!.id,
      ticketNumber: row.request!.ticket_number,
      type: row.request!.type,
      requestStatus: row.request!.status,
      product: row.product,
      quantity: row.quantity,
      unitValue: row.unit_value,
      paymentReleased: row.payment_released,
      paymentReleasedAt: row.payment_released_at,
      paymentAuthorizedBy: row.payment_authorized_by,
      assemblerName: row.request!.assembler_name,
      clientName: row.request!.client_name,
      orderCode: row.request!.order_code,
      storeName: row.request!.stores?.name ?? "",
      createdAt: row.request!.created_at,
    }));

  return items.filter((i) => {
    if (opts.assemblerName && i.assemblerName !== opts.assemblerName) return false;
    if (opts.dateFrom && i.createdAt < opts.dateFrom) return false;
    if (opts.dateTo && i.createdAt > `${opts.dateTo}T23:59:59`) return false;
    if (opts.alvo && isMostruarioRequest(i.orderCode, i.clientName) !== (opts.alvo === "mostruario")) return false;
    return true;
  });
}

// Só conta como "pendente de liberação" quem já teve a montagem concluída —
// item com valor definido mas ainda "a montar" não entra nessa conta.
export async function countPendingPayments(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("service_request_items")
    .select("id, request:service_requests!inner(status)", { count: "exact", head: true })
    .not("unit_value", "is", null)
    .eq("payment_released", false)
    .eq("request.status", "concluida");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
