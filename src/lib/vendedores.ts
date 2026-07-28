import { getSupabaseAdmin } from "./supabaseAdmin";

// Vendedor não loga em lugar nenhum — esse cadastro existe só pra alimentar o
// datalist do campo "Vendedor responsável" na criação de um pedido de
// encomenda (ver NovoPedidoEncomendaForm.tsx), preenchido por quem de fato
// lança o pedido (caixa/gerente/CD/fábrica). "ativo" controla só se o nome
// ainda aparece nas sugestões (ex.: vendedor que saiu da empresa).
export type VendedorInfo = { name: string; storeId: string; storeName: string; ativo: boolean };

type VendedorRow = { name: string; store_id: string; ativo: boolean; stores: { name: string } | null };

export async function listVendedores(): Promise<VendedorInfo[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("vendedores").select("name, store_id, ativo, stores(name)").order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as VendedorRow[]).map((v) => ({
    name: v.name,
    storeId: v.store_id,
    storeName: v.stores?.name ?? v.store_id,
    ativo: v.ativo,
  }));
}

// Usado pela tela de equipe do gerente (src/app/assistencia/loja/equipe/page.tsx),
// que só pode ver/gerenciar os vendedores das próprias lojas.
export async function listVendedoresForStores(storeIds: string[]): Promise<VendedorInfo[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("vendedores")
    .select("name, store_id, ativo, stores(name)")
    .in("store_id", storeIds)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as VendedorRow[]).map((v) => ({
    name: v.name,
    storeId: v.store_id,
    storeName: v.stores?.name ?? v.store_id,
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
