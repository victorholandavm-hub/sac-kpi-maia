import { getSupabaseAdmin } from "./supabaseAdmin";

export type VendedorWithPinStatus = { name: string; storeId: string; storeName: string; hasPin: boolean; ativo: boolean };

type VendedorRow = { name: string; store_id: string; pin_hash: string | null; ativo: boolean; stores: { name: string } | null };

export async function listVendedoresWithPinStatus(): Promise<VendedorWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("vendedores").select("name, store_id, pin_hash, ativo, stores(name)").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as VendedorRow[]).map((v) => ({
    name: v.name,
    storeId: v.store_id,
    storeName: v.stores?.name ?? v.store_id,
    hasPin: !!v.pin_hash,
    ativo: v.ativo,
  }));
}

// Usado pela tela de equipe do gerente (src/app/assistencia/loja/equipe/page.tsx),
// que só pode ver/gerenciar os vendedores das próprias lojas.
export async function listVendedoresForStores(storeIds: string[]): Promise<VendedorWithPinStatus[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("vendedores")
    .select("name, store_id, pin_hash, ativo, stores(name)")
    .in("store_id", storeIds)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as VendedorRow[]).map((v) => ({
    name: v.name,
    storeId: v.store_id,
    storeName: v.stores?.name ?? v.store_id,
    hasPin: !!v.pin_hash,
    ativo: v.ativo,
  }));
}

export async function addVendedor(name: string, storeId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("vendedores").insert({ name, store_id: storeId });
  if (error) throw new Error(error.message);
}

export async function setVendedorAtivo(name: string, ativo: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("vendedores").update({ ativo }).eq("name", name);
  if (error) throw new Error(error.message);
}

// Usado pelas Server Actions pra descobrir a loja do vendedor autenticado sem
// confiar em nada vindo do cliente além do nome já verificado pela sessão
// HMAC — mesmo princípio de getGerenteStoreIds (src/lib/gerentes.ts). Só
// retorna a loja se a conta estiver ativa.
export async function getVendedorStoreId(name: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("vendedores").select("store_id, ativo").eq("name", name).maybeSingle();
  if (!data || !data.ativo) return null;
  return data.store_id as string;
}
