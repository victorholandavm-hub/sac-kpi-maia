import { getSupabaseAdmin } from "./supabaseAdmin";

export type Gerente = { name: string; storeIds: string[] };

type GerenteStoresRow = { name: string; gerente_stores: { store_id: string }[] | null };

export async function listGerentes(): Promise<Gerente[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("gerentes").select("name, gerente_stores(store_id)").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as GerenteStoresRow[]).map((g) => ({
    name: g.name,
    storeIds: (g.gerente_stores ?? []).map((s) => s.store_id),
  }));
}

export type GerenteWithPinStatus = Gerente & { storeNames: string[]; hasPin: boolean };

type GerenteWithPinRow = {
  name: string;
  pin_hash: string | null;
  gerente_stores: { store_id: string; stores: { name: string } | null }[] | null;
};

export async function listGerentesWithPinStatus(): Promise<GerenteWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("gerentes")
    .select("name, pin_hash, gerente_stores(store_id, stores(name))")
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as GerenteWithPinRow[]).map((g) => ({
    name: g.name,
    storeIds: (g.gerente_stores ?? []).map((s) => s.store_id),
    storeNames: (g.gerente_stores ?? []).map((s) => s.stores?.name ?? s.store_id),
    hasPin: !!g.pin_hash,
  }));
}

// Usado pelas Server Actions pra descobrir as lojas do gerente autenticado sem
// confiar em nada vindo do cliente (formulário, cookie) além do nome já
// verificado pela sessão HMAC — ver src/app/assistencia/loja-actions.ts.
export async function getGerenteStoreIds(name: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("gerente_stores").select("store_id").eq("gerente_name", name);
  return (data ?? []).map((r) => r.store_id as string);
}

// Substitui por completo o conjunto de lojas de um gerente (usado tanto pra
// cadastrar quanto pra editar as lojas de um gerente já existente).
export async function setGerenteStores(name: string, storeIds: string[]): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error: deleteError } = await admin.from("gerente_stores").delete().eq("gerente_name", name);
  if (deleteError) throw new Error(deleteError.message);
  if (storeIds.length === 0) return;
  const { error: insertError } = await admin
    .from("gerente_stores")
    .insert(storeIds.map((storeId) => ({ gerente_name: name, store_id: storeId })));
  if (insertError) throw new Error(insertError.message);
}
