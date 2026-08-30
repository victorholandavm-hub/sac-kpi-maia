import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import type { DateRange } from "./dateRange";
import type { Count, DayCount } from "./kpi";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS, DELIVERY_REQUEST_TYPES } from "./assistenciaLabels";
import { ROTA_LABELS, type Rota } from "./rotas";
import { classificarProdutoAssistencia } from "./vendasProduto";
import type { RequestType, RequestStatus, ReportRowItem } from "./serviceRequests";

// "KPIs da Assistência" (página própria, /kpis-assistencia) -- pedido do
// Victor 27/08/2026: "preciso que você pegue todas as informações de
// todas as notificações de assistencias... quais produtos tem mais
// assistencia, qual rota tem mais assistencias, quem errou... a
// volumetria de assistencia por periodo, quais lojas mais tem
// assistencias", refinado 27/08/2026: "preciso que os kpis da
// assistencia fiquem numa aba separada, sozinha" (saiu de dentro do
// painel de KPIs geral, ver Dashboard.tsx/kpis/page.tsx -- virou página
// própria) + "por atendente... por grupo de produto". Fonte é
// `service_requests`/`service_request_items` -- domínio TOTALMENTE
// separado do resto do painel de KPIs (que é só sobre conversas do GHL,
// ver kpi.ts) -- por isso um módulo próprio, sem misturar no tipo
// KpiData existente.
//
// Escopo de tipo (27/08/2026, 2ª correção): primeira versão contava
// "tudo menos montagem/vistoria/desmontagem" (incluindo Troca de peça,
// visita de montador sem motorista/rota) -- Victor notou que o total
// (216) não batia com "139 solicitações" da aba Entregas
// (fila/page.tsx?tab=pecas) e confirmou que os dados que importam pra
// esse relatório são só os de Entregas mesmo. Reaproveita
// DELIVERY_REQUEST_TYPES (assistenciaLabels.ts) direto -- é a MESMA
// constante que Entregas usa (via ENTREGA_TYPES, entregaQueueGrouping.ts)
// pra nunca mais divergir.

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
  requested_by_name: string | null;
  stores: { name: string } | null;
  requester: { full_name: string } | null;
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

function atendenteName(r: RequestRow): string | null {
  return r.requester?.full_name ?? r.requested_by_name;
}

// Conferente/motorista (causa_conferente/driver_name) são texto livre
// digitado na hora, sem cadastro -- achado 27/08/2026 (Victor: "nos
// conferentes EVERTON e Everton sao a mesma pessoa, DIEGO e diego sao a
// mesma pessoa"): a mesma pessoa em caixas diferentes virava duas barras
// separadas no ranking. Agrupa por versão maiúscula (chave insensível a
// caixa) e mostra sempre em Title Case -- não corrige grafia diferente
// pro mesmo nome (ex.: apelido vs. nome completo), só a caixa.
// `.toUpperCase()` faz o agrupamento; a capitalização de exibição evita
// `\b` do regex (não é Unicode-aware em JS -- "á" quebraria "FLÁVIO" no
// meio), separando por espaço/barra manualmente.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/([\s/])/)
    .map((part) => (part === " " || part === "/" ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

// Apelido/variação do mesmo conferente que a normalização de caixa acima
// não resolve sozinha (texto genuinamente diferente, não só maiúscula/
// minúscula) -- pedido do Victor 28/08/2026: "vinicius jp e vinicios sao
// a mesma pessoa". Chave e valor já em caixa alta (mesmo formato da
// chave de agrupamento) -- extensível pra próximo caso parecido, sem
// precisar duplicar a lógica de agrupamento.
const CONFERENTE_ALIASES: Record<string, string> = {
  "VINICIUS JP": "VINICIOS",
};

function canonicalConferenteKey(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return CONFERENTE_ALIASES[upper] ?? upper;
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
  // Contagem de verdade de produtos distintos -- byProduct abaixo é
  // cortado em PRODUCT_RANKING_LIMIT (senão o gráfico vira uma parede de
  // barras ilegível), então `byProduct.length` SUBESTIMA o total sempre
  // que passa do limite (achado 27/08/2026, pedido do Victor "revise
  // essa tela inteira": 136 produtos distintos de verdade, StatTile
  // mostrando 20). Esse campo existe só pro StatTile "Produtos distintos
  // com chamado" -- o gráfico continua usando byProduct (cortado).
  distinctProductCount: number;
  byProduct: Count[];
  byProductGroup: Count[];
  // Produtos com mais chamados por defeito de fabricação especificamente
  // (causa_raiz = 'defeito_fabricacao') -- subconjunto de byProduct acima,
  // não o mesmo ranking. Ver comentário em getAssistenciaKpiData.
  byProductDefeitoFabricacao: Count[];
  byAgent: Count[];
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
          "id, ticket_number, type, status, store_id, rota, causa_raiz, causa_conferente, driver_name, created_at, client_name, reason, requested_by_name, stores(name), requester:profiles!requested_by(full_name)",
          { count: "exact" }
        )
        .in("type", DELIVERY_REQUEST_TYPES)
        // Cancelada não conta pra nenhum KPI aqui -- pedido do Victor
        // 29/08/2026: "as notificações de assistencia que foram canceladas
        // não precisam aparecer nos kpis da assistencia". Chamado cancelado
        // não virou entrega de verdade (não tem produto errado, rota que
        // falhou, motorista que errou etc.) -- contar ele infla volumetria/
        // rankings com algo que nem chegou a acontecer.
        .not("status", "eq", "cancelada")
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
  // Quem registrou o chamado (requested_by, ver toSummary em
  // serviceRequests.ts pro mesmo fallback join→texto) -- "atendente" no
  // sentido de quem atendeu/criou a notificação, não quem tá responsável
  // por ela agora (esse último muda de dono com claimRequest).
  const byAgent = aggregate(rows, atendenteName, (k) => k, ticketsByTag, "atendente");
  // Ver titleCase acima -- agrupa por nome em caixa alta (mesma pessoa,
  // caixa diferente, conta junto), exibe sempre em Title Case.
  const byConferente = aggregate(
    rows.filter((r) => r.causa_raiz === "erro_conferencia" && r.causa_conferente),
    (r) => canonicalConferenteKey(r.causa_conferente!),
    titleCase,
    ticketsByTag,
    "conferente"
  );
  // Ressalva importante: `driver_name` também é sobrescrito toda vez que
  // a rota/data do chamado é reagendada (setSchedule, actions.ts) -- pra
  // um chamado criado com causa_raiz='erro_motorista' e depois
  // remarcado, esse valor pode já não ser mais quem entregou errado, e
  // sim o motorista da entrega de verdade. Única fonte disponível sem
  // mexer em schema -- a tela mostra uma nota curta sobre isso perto
  // desse ranking.
  const byMotoristaErro = aggregate(
    rows.filter((r) => r.causa_raiz === "erro_motorista" && r.driver_name),
    (r) => r.driver_name!.trim().toUpperCase(),
    titleCase,
    ticketsByTag,
    "motorista"
  );

  // Produto (e grupo de produto) -- de service_request_items, dedupe por
  // (request_id, product) antes de contar: "em quantos chamados esse
  // produto apareceu", não soma de quantidade (2 unidades do mesmo
  // produto no mesmo chamado contam 1 vez). Grupo usa
  // classificarProdutoAssistencia (vendasProduto.ts) -- variante de
  // classificarProduto (a mesma que /vendas usa) com um fallback extra
  // pra descrição de PEÇA avulsa ("PORTA DIREITA N13", "1UN. ESPELHO"),
  // comum em chamado de assistência e que antes caía tudo genérico em
  // "Outros" -- ver comentário na função (achado 29/08/2026, pedido do
  // Victor pra melhorar a classificação). Dedupe PRÓPRIO por (request_id,
  // grupo), não o mesmo de produto: achado 27/08/2026 (revisão pedida
  // pelo Victor) -- um chamado com 2 produtos DIFERENTES que caem no
  // mesmo grupo (ex.: #4949, troca_produto com "Sofa novo" + "Sofa
  // avariado", os dois classificam como "Sala de estar / jantar") contava
  // esse chamado 2x no grupo, sem o dedupe à parte.
  const produtoPorChamado = new Set<string>();
  const grupoPorChamado = new Set<string>();
  const produtoCount = new Map<string, number>();
  const grupoCount = new Map<string, { label: string; count: number }>();
  // Ranking própria de "produto com mais defeito de fabricação" -- pedido
  // do Victor 29/08/2026: "consegue colocar o ranking de produtos com
  // mais erros de fabricação nos kpis da assistencia?". Mesmo dedupe por
  // (request_id, product) do ranking geral acima (não soma de
  // quantidade), só que restrito às linhas com causa_raiz =
  // 'defeito_fabricacao' -- tag própria ("produto_defeito:") pro
  // drill-down não misturar com os chamados do ranking geral (que inclui
  // TODOS os motivos, não só defeito de fabricação).
  const produtoDefeitoPorChamado = new Set<string>();
  const produtoDefeitoCount = new Map<string, number>();
  for (const item of items) {
    if (!item.product) continue;
    const parentRow = rowById.get(item.request_id);
    if (!parentRow) continue;

    const dedupeKey = `${item.request_id}::${item.product}`;
    if (!produtoPorChamado.has(dedupeKey)) {
      produtoPorChamado.add(dedupeKey);
      produtoCount.set(item.product, (produtoCount.get(item.product) ?? 0) + 1);
      const produtoTag = `produto:${item.product}`;
      (ticketsByTag[produtoTag] ??= []).push(toReportRowItem(parentRow));
    }

    if (parentRow.causa_raiz === "defeito_fabricacao" && !produtoDefeitoPorChamado.has(dedupeKey)) {
      produtoDefeitoPorChamado.add(dedupeKey);
      produtoDefeitoCount.set(item.product, (produtoDefeitoCount.get(item.product) ?? 0) + 1);
      const produtoDefeitoTag = `produto_defeito:${item.product}`;
      (ticketsByTag[produtoDefeitoTag] ??= []).push(toReportRowItem(parentRow));
    }

    const grupo = classificarProdutoAssistencia(item.product);
    const grupoDedupeKey = `${item.request_id}::${grupo.key}`;
    if (!grupoPorChamado.has(grupoDedupeKey)) {
      grupoPorChamado.add(grupoDedupeKey);
      const grupoEntry = grupoCount.get(grupo.key) ?? { label: grupo.label, count: 0 };
      grupoEntry.count++;
      grupoCount.set(grupo.key, grupoEntry);
      const grupoTag = `grupo:${grupo.key}`;
      (ticketsByTag[grupoTag] ??= []).push(toReportRowItem(parentRow));
    }
  }
  const byProduct: Count[] = [...produtoCount.entries()]
    .map(([product, count]) => ({ label: product, count, tag: `produto:${product}` }))
    .sort((a, b) => b.count - a.count)
    .slice(0, PRODUCT_RANKING_LIMIT);
  const byProductGroup: Count[] = [...grupoCount.entries()]
    .map(([key, { label, count }]) => ({ label, count, tag: `grupo:${key}` }))
    .sort((a, b) => b.count - a.count);
  const byProductDefeitoFabricacao: Count[] = [...produtoDefeitoCount.entries()]
    .map(([product, count]) => ({ label: product, count, tag: `produto_defeito:${product}` }))
    .sort((a, b) => b.count - a.count)
    .slice(0, PRODUCT_RANKING_LIMIT);

  return {
    totalChamados: rows.length,
    dailyVolume,
    distinctProductCount: produtoCount.size,
    byProduct,
    byProductGroup,
    byProductDefeitoFabricacao,
    byAgent,
    byRota,
    byStore,
    byType,
    byCausaRaiz,
    byConferente,
    byMotoristaErro,
    ticketsByTag,
  };
}
