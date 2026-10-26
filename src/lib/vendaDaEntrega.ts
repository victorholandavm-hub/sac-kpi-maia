import type { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchInBatches } from "./supabaseBatch";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";

// Venda de cada entrega (função venda_das_entregas, migração 0200): mesmo
// cliente e mesma filial, emitida até a primeira carga, desempate pelos
// produtos em comum. Substitui o cruzamento pela nota fiscal da carga, que é
// a de remessa do CD e casava com venda de outra loja e outro cliente
// (achado do Victor 26/10/2026 -- os NPS de entrega e de compra foram pra
// quem não recebeu a entrega desde 22/09).

type Admin = ReturnType<typeof getSupabaseAdmin>;
export type VendaDaEntrega = { orderId: string; issueDate: string; criterio: "produto" | "unica" | "mais_recente" };
export type VendaCandidata = { id: string; invoice: string | null; serie: string | null; client_id: string | null; client_name: string | null };

const LOTE_RPC = 300;

export async function vendasDasEntregas(admin: Admin, deliveryIds: string[]): Promise<Map<string, VendaDaEntrega>> {
  const ids = [...new Set(deliveryIds)];
  const mapa = new Map<string, VendaDaEntrega>();
  for (let i = 0; i < ids.length; i += LOTE_RPC) {
    const { data, error } = await admin.rpc("venda_das_entregas", { p_ids: ids.slice(i, i + LOTE_RPC) });
    if (error) throw new Error(`venda_das_entregas: ${error.message}`);
    for (const r of (data ?? []) as { delivery_id: string; order_id: string; issue_date: string; criterio: VendaDaEntrega["criterio"] }[]) {
      mapa.set(r.delivery_id, { orderId: r.order_id, issueDate: r.issue_date, criterio: r.criterio });
    }
  }
  return mapa;
}

// Vendas das entregas que voltaram com resultado (statusEntrega em
// `resolvidos`) entre `de` e `ate` (data da baixa) -- base dos NPS de entrega
// e de compra. Entrega sem venda achada fica de fora.
export async function vendasDasEntregasResolvidas(
  admin: Admin,
  de: string,
  ate: string,
  resolvidos: readonly string[]
): Promise<VendaCandidata[]> {
  const cargas = await fetchAllPagesParallel<{ delivery_id: string }>((from, to) =>
    admin
      .from("totvs_delivery_cargas")
      .select("delivery_id", { count: "exact" })
      .gte("dt_retorno", de)
      .lte("dt_retorno", ate)
      .in("status_entrega", resolvidos as string[])
      .order("id")
      .range(from, to) as unknown as PromiseLike<PagedQueryResult<{ delivery_id: string }>>
  );
  if (cargas.length === 0) return [];
  const vendas = await vendasDasEntregas(admin, cargas.map((c) => c.delivery_id));
  const orderIds = [...new Set([...vendas.values()].map((v) => v.orderId))];
  return fetchInBatches<VendaCandidata>(orderIds, (lote) =>
    admin.from("totvs_orders").select("id, invoice, serie, client_id, client_name").in("id", lote)
  );
}
