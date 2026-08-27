import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import type { DateRange } from "./dateRange";
import type { Count, DayCount } from "./kpi";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS } from "./assistenciaLabels";
import { ROTA_LABELS, type Rota } from "./rotas";
import type { RequestType, RequestStatus, ReportRowItem } from "./serviceRequests";

// Aba "KPIs da Assistência" (painel de KPIs do SAC, /kpis) -- pedido do
// Victor 27/08/2026: "preciso que você pegue todas as informações de
// todas as notificações de assistencias e coloque na tela de kpis do
// sac... quais produtos tem mais assistencia, qual rota tem mais
// assistencias, quem errou, o nome de quem errou, quantas vezes errou e a
// volumetria de assistencia por periodo, quais lojas mais tem
// assistencias". Fonte é `service_requests`/`service_request_items` --
// domínio TOTALMENTE separado do resto do painel de KPIs (que é só sobre
// conversas do GHL, ver kpi.ts) -- por isso um módulo próprio, sem
// misturar no tipo KpiData existente.

type RequestRow = {
  id: string;
  ticket_number: number;
  type: RequestType;
  status: RequestStatus;
  store_id: string;
  rota: Rota | null;
  causa_raiz: string | null;
  causa_conferente: string | null;
  driver_name: string | null;
  created_at: string;
  client_name: string | null;
  reason: string | null;
  stores: { name: string } | null;
};

const PAGE_SIZE = 1000;

function toReportRowItem(r: RequestRow): ReportRowItem {
  return {
    id: r.id,
    ticketNumber: r.ticket_number,
    type: r.type,
    status: r.status,
    clientName: r.client_name,
    storeName: r.stores?.name ?? r.store_id,
    createdAt: r.created_at,
    reason: r.reason,
  };
}

// Mesmo espírito do `aggregate()` de getRequestsReport (serviceRequests.ts)
// -- agrupa por chave, guarda os chamados de cada grupo pro drill-down
// (aqui num Record só, `ticketsByTag`, compartilhado entre todos os
// rankings da tela em vez de um Map por ranking).
function aggregate(
  rows: RequestRow[],
  keyFn: (r: RequestRow) => string | null,
  labelFn: (key: string) => string,
  ticketsByTag: Record<string, ReportRowItem[]>,
  tagPrefix: string
): Count[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = keyFn(r);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const tag = `${tagPrefix}:${key}`;
    (ticketsByTag[tag] ??= []).push(toReportRowItem(r));
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ label: labelFn(key), count, tag: `${tagPrefix}:${key}` }))
    .sort((a, b) => b.count - a.count);
}

export type AssistenciaKpiData = {
  totalChamados: number;
  dailyVolume: DayCount[];
  byProduct: Count[];
  byRota: Count[];
  byStore: Count[];
  byType: Count[];
  byCausaRaiz: Count[];
  byConferente: Count[];
  byMotoristaErro: Count[];
  // Chave = `tag` de cada Count acima (ex.: "rota:praia") -- ver
  // AssistenciaTicketsModal.tsx.
  ticketsByTag: Record<string, ReportRowItem[]>;
};

const PRODUCT_RANKING_LIMIT = 20;

export async function getAssistenciaKpiData(range: DateRange): Promise<AssistenciaKpiData> {
  const admin = getSupabaseAdmin();
  const fromIso = range.from ? range.from.toISOString() : null;
  const toIso = range.to.toISOString();

  const rows = await fetchAllPagesParallel<RequestRow>(
    (from, to) => {
      let query = admin
        .from("service_requests")
        .select(
          "id, ticket_number, type, status, store_id, rota, causa_raiz, causa_conferente, driver_name, created_at, client_name, reason, stores(name)",
          { count: "exact" }
        )
        .lte("created_at", toIso);
      if (fromIso) query = query.gte("created_at", fromIso);
      return query.range(from, to) as unknown as PromiseLike<PagedQueryResult<RequestRow>>;
    },
    { pageSize: PAGE_SIZE }
  );

  const ids = rows.map((r) => r.id);
  type ItemRow = { request_id: string; product: string | null };
  const items =
    ids.length === 0
      ? []
      : await fetchAllPagesParallel<ItemRow>(
          (from, to) =>
            admin
              .from("service_request_items")
              .select("request_id, product", { count: "exact" })
              .in("request_id", ids)
              .range(from, to) as unknown as PromiseLike<PagedQueryResult<ItemRow>>,
          { pageSize: PAGE_SIZE }
        );

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const ticketsByTag: Record<string, ReportRowItem[]> = {};

  // Volumetria por dia -- mesmo formato (DayCount) do resto do painel de
  // KPIs, pra reaproveitar VolumeChart direto.
  const porDia = new Map<string, number>();
  for (const r of rows) {
    const dia = r.created_at.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const dailyVolume: DayCount[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const byRota = aggregate(rows, (r) => r.rota, (k) => ROTA_LABELS[k as Rota] ?? k, ticketsByTag, "rota");
  const byStore = aggregate(rows, (r) => r.stores?.name ?? r.store_id, (k) => k, ticketsByTag, "loja");
  const byType = aggregate(rows, (r) => r.type, (k) => REQUEST_TYPE_LABELS[k as RequestType] ?? k, ticketsByTag, "tipo");
  const byCausaRaiz = aggregate(rows, (r) => r.causa_raiz, (k) => CAUSA_RAIZ_LABELS[k] ?? k, ticketsByTag, "causa");
  // Conferente/motorista são texto livre digitado na hora -- normaliza só
  // espaço nas pontas (trim), sem tentar corrigir grafia/capitalização
  // diferente pro mesmo nome (fora de escopo aqui).
  const byConferente = aggregate(
    rows.filter((r) => r.causa_raiz === "erro_conferencia" && r.causa_conferente),
    (r) => r.causa_conferente!.trim(),
    (k) => k,
    ticketsByTag,
    "conferente"
  );
  // Ressalva importante (ver plano): `driver_name` também é sobrescrito
  // toda vez que a rota/data do chamado é reagendada (setSchedule,
  // actions.ts) -- pra um chamado criado com causa_raiz='erro_motorista' e
  // depois remarcado, esse valor pode já não ser mais quem entregou
  // errado, e sim o motorista da entrega de verdade. Única fonte
  // disponível sem mexer em schema -- a tela mostra uma nota curta sobre
  // isso perto desse ranking.
  const byMotoristaErro = aggregate(
    rows.filter((r) => r.causa_raiz === "erro_motorista" && r.driver_name),
    (r) => r.driver_name!.trim(),
    (k) => k,
    ticketsByTag,
    "motorista"
  );

  // Produto -- de service_request_items, dedupe por (request_id, product)
  // antes de contar: "em quantos chamados esse produto apareceu", não
  // soma de quantidade (2 unidades do mesmo produto no mesmo chamado
  // contam 1 vez).
  const produtoPorChamado = new Set<string>();
  const produtoCount = new Map<string, number>();
  for (const item of items) {
    if (!item.product) continue;
    const dedupeKey = `${item.request_id}::${item.product}`;
    if (produtoPorChamado.has(dedupeKey)) continue;
    produtoPorChamado.add(dedupeKey);
    produtoCount.set(item.product, (produtoCount.get(item.product) ?? 0) + 1);
    const tag = `produto:${item.product}`;
    const parentRow = rowById.get(item.request_id);
    if (parentRow) (ticketsByTag[tag] ??= []).push(toReportRowItem(parentRow));
  }
  const byProduct: Count[] = [...produtoCount.entries()]
    .map(([product, count]) => ({ label: product, count, tag: `produto:${product}` }))
    .sort((a, b) => b.count - a.count)
    .slice(0, PRODUCT_RANKING_LIMIT);

  return {
    totalChamados: rows.length,
    dailyVolume,
    byProduct,
    byRota,
    byStore,
    byType,
    byCausaRaiz,
    byConferente,
    byMotoristaErro,
    ticketsByTag,
  };
}
