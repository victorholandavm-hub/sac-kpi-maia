import { getSupabaseAdmin } from "./supabaseAdmin";

export type CaixaWithPinStatus = { name: string; storeId: string; storeName: string; hasPin: boolean; ativo: boolean };

type CaixaRow = { name: string; store_id: string; pin_hash: string | null; ativo: boolean; stores: { name: string } | null };

export async function listCaixasWithPinStatus(): Promise<CaixaWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("caixas").select("name, store_id, pin_hash, ativo, stores(name)").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CaixaRow[]).map((c) => ({
    name: c.name,
    storeId: c.store_id,
    storeName: c.stores?.name ?? c.store_id,
    hasPin: !!c.pin_hash,
    ativo: c.ativo,
  }));
}

// Usado pela tela de equipe do gerente (src/app/assistencia/loja/equipe/page.tsx),
// que só pode ver/gerenciar as caixas das próprias lojas.
export async function listCaixasForStores(storeIds: string[]): Promise<CaixaWithPinStatus[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("caixas")
    .select("name, store_id, pin_hash, ativo, stores(name)")
    .in("store_id", storeIds)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CaixaRow[]).map((c) => ({
    name: c.name,
    storeId: c.store_id,
    storeName: c.stores?.name ?? c.store_id,
    hasPin: !!c.pin_hash,
    ativo: c.ativo,
  }));
}

export async function addCaixa(name: string, storeId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("caixas").insert({ store_id: storeId, name });
  if (error) throw new Error(error.message);
}

export async function setCaixaAtivo(name: string, ativo: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("caixas").update({ ativo }).eq("name", name);
  if (error) throw new Error(error.message);
}

// Usado pelas Server Actions pra descobrir a loja da caixa autenticada sem
// confiar em nada vindo do cliente além do nome já verificado pela sessão
// HMAC — mesmo princípio de getGerenteStoreIds (src/lib/gerentes.ts). Só
// retorna a loja se a conta estiver ativa, senão a sessão vira inválida na
// prática (resolveEncomendaRequester não consegue mais resolver a loja).
export async function getCaixaStoreId(name: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("caixas").select("store_id, ativo").eq("name", name).maybeSingle();
  if (!data || !data.ativo) return null;
  return data.store_id as string;
}
