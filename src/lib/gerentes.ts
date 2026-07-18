import { getSupabaseAdmin } from "./supabaseAdmin";

export type Gerente = { name: string; storeId: string };

export async function listGerentes(): Promise<Gerente[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("gerentes").select("name, store_id").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((g) => ({ name: g.name as string, storeId: g.store_id as string }));
}

export type GerenteWithPinStatus = Gerente & { storeName: string; hasPin: boolean };

export async function listGerentesWithPinStatus(): Promise<GerenteWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("gerentes").select("name, store_id, pin_hash, stores(name)").order("name");
  if (error) throw new Error(error.message);
  type Row = { name: string; store_id: string; pin_hash: string | null; stores: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((g) => ({
    name: g.name,
    storeId: g.store_id,
    storeName: g.stores?.name ?? g.store_id,
    hasPin: !!g.pin_hash,
  }));
}

// Usado pelas Server Actions pra descobrir a loja do gerente autenticado sem
// confiar em nada vindo do cliente (formulário, cookie) além do nome já
// verificado pela sessão HMAC — ver src/app/assistencia/loja-actions.ts.
export async function getGerenteStoreId(name: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("gerentes").select("store_id").eq("name", name).maybeSingle();
  return (data?.store_id as string | undefined) ?? null;
}
