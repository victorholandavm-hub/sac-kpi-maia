import { getSupabaseAdmin } from "./supabaseAdmin";
import { hashPin } from "./montadorAuth";

export async function listAssemblers(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assemblers").select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => a.name as string);
}

// Montadores da(s) loja(s) informada(s) + os globais/legado (store_id nulo)
// -- usado pra sugerir montador na criação de solicitação de uma loja
// específica (src/app/assistencia/(app)/[id]/page.tsx, nova-rapida).
export async function listAssemblersForStores(storeIds: string[]): Promise<string[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("assemblers")
    .select("name")
    .or(`store_id.in.(${storeIds.join(",")}),store_id.is.null`)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => a.name as string);
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
  const { data, error } = await admin
    .from("assemblers")
    .select("name, store_id, stores(name)")
    .or(`store_id.in.(${storeIds.join(",")}),store_id.is.null`)
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

export async function listDrivers(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("drivers").select("name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => d.name as string);
}

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
  requestStatus: string;
  product: string;
  quantity: number;
  unitValue: number | null;
  paymentReleased: boolean;
  paymentReleasedAt: string | null;
  paymentAuthorizedBy: string | null;
  assemblerName: string | null;
  clientName: string | null;
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
    status: string;
    assembler_name: string | null;
    client_name: string | null;
    created_at: string;
    stores: { name: string } | null;
  } | null;
};

export async function listPaymentItems(
  opts: { assemblerName?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<PaymentItem[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_request_items")
    .select(
      "id, product, quantity, unit_value, payment_released, payment_released_at, payment_authorized_by, request:service_requests(id, status, assembler_name, client_name, created_at, stores(name))"
    )
    .not("unit_value", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as PaymentItemRow[])
    .filter((row) => row.request !== null)
    .map((row) => ({
      itemId: row.id,
      requestId: row.request!.id,
      requestStatus: row.request!.status,
      product: row.product,
      quantity: row.quantity,
      unitValue: row.unit_value,
      paymentReleased: row.payment_released,
      paymentReleasedAt: row.payment_released_at,
      paymentAuthorizedBy: row.payment_authorized_by,
      assemblerName: row.request!.assembler_name,
      clientName: row.request!.client_name,
      storeName: row.request!.stores?.name ?? "",
      createdAt: row.request!.created_at,
    }));

  return items.filter((i) => {
    if (opts.assemblerName && i.assemblerName !== opts.assemblerName) return false;
    if (opts.dateFrom && i.createdAt < opts.dateFrom) return false;
    if (opts.dateTo && i.createdAt > `${opts.dateTo}T23:59:59`) return false;
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
