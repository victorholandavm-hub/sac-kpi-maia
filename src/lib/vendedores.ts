import { getSupabaseAdmin } from "./supabaseAdmin";

export type VendedorWithPinStatus = { name: string; storeId: string; storeName: string; hasPin: boolean };

type VendedorRow = { name: string; store_id: string; pin_hash: string | null; stores: { name: string } | null };

export async function listVendedoresWithPinStatus(): Promise<VendedorWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("vendedores").select("name, store_id, pin_hash, stores(name)").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as VendedorRow[]).map((v) => ({
    name: v.name,
    storeId: v.store_id,
    storeName: v.stores?.name ?? v.store_id,
    hasPin: !!v.pin_hash,
  }));
}

export async function addVendedor(name: string, storeId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("vendedores").insert({ name, store_id: storeId });
  if (error) throw new Error(error.message);
}

// Usado pelas Server Actions pra descobrir a loja do vendedor autenticado sem
// confiar em nada vindo do cliente além do nome já verificado pela sessão
// HMAC — mesmo princípio de getGerenteStoreIds (src/lib/gerentes.ts).
export async function getVendedorStoreId(name: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("vendedores").select("store_id").eq("name", name).maybeSingle();
  return (data?.store_id as string | undefined) ?? null;
}
