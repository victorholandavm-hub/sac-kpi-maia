import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import type { DateRange } from "./dateRange";
import type { Count, Coverage, DayCount } from "./kpi";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS, DELIVERY_REQUEST_TYPES } from "./assistenciaLabels";
import { ROTA_LABELS, type Rota } from "./rotas";
import {
  classificarProdutoAssistencia,
  getVendaQuantidadePorCodigoNoPeriodo,
  getCustoUnitarioPorCodigo,
  getEarliestSyncedOrderDate,
} from "./vendasProduto";
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
  // Achado 08/09/2026 (pedido do Victor: "vinicius e vinicios são a mesma
  // pessoa"): "Vinicius"/"VINICIUS" solo, sem o "JP" do alias acima,
  // também aparecia como causa_conferente -- mesmo conferente, grafia
  // diferente. Não mexe em "VINICIOS E FLÁVIO"/"VINICIOS/FLÁVIO" (combo
  // com outra pessoa, responsabilidade conjunta, não é o mesmo caso).
  VINICIUS: "VINICIOS",
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
  // Ranking por Taxa de Quebra (ver ProductBreakageStat acima) -- diferente
  // de byProduct (que ordena por volume de chamados): esse ordena por %
  // chamados/vendas. Mesmo corte de PRODUCT_RANKING_LIMIT.
  byProductBreakage: ProductBreakageStat[];
  // Mesmo conjunto, ordenado por PREJUÍZO (R$) em vez de Taxa de Quebra
  // (%) -- usado só no detalhamento do card de destaque
  // (PrejuizoDetalheModal.tsx), não no gráfico principal. Ver comentário
  // em byProductBreakageTopValor acima (getAssistenciaKpiData).
  byProductBreakageTopValor: ProductBreakageStat[];
  // Prejuízo de estoque (produto) + custo operacional estático, somados
  // sobre TODO o conjunto (não só os 20 exibidos no gráfico) -- pedido do
  // Victor 10/09/2026: "refaça o cálculo... pra que ele seja a soma do
  // Prejuízo de Estoque + Custo Operacional Estático". Card de destaque
  // "Prejuízo Total Estimado em Estoque".
  prejuizoTotalEstimado: number;
  // As duas parcelas de prejuizoTotalEstimado, separadas -- pedido do
  // Victor 10/09/2026: "quando clicar nesse prejuízo, mostre os valores
  // detalhados e como chegou a esse valor". PrejuizoDetalheModal.tsx usa
  // isso pra montar "Estoque (RX) + Operacional (RY) = Total (RZ)" sem
  // ter que resomar nada no cliente.
  prejuizoEstoqueTotalEstimado: number;
  custoOperacionalTotalEstimado: number;
  // Breakdown do custo operacional POR TIPO (ver CUSTO_OPERACIONAL_POR_TIPO)
  // -- mesma finalidade acima, "como chegou a esse valor" por tipo de
  // chamado (ex.: "62 chamados de Troca de produto × R$120 = R$7.440").
  custoOperacionalPorTipo: CustoOperacionalPorTipoRow[];
  // Transparência só da parte de ESTOQUE (produto): quantos chamados de
  // fato tinham part_code E custo conhecido, sobre o total -- vira badge
  // no StatTile. O custo operacional não precisa disso, é sempre um valor
  // conhecido por construção (ver CUSTO_OPERACIONAL_POR_TIPO).
  prejuizoCobertura: Coverage;
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

// Taxa de Quebra / Prejuízo de Estoque -- pedido do Victor 10/09/2026:
// cruzar chamado com venda do mesmo produto no período (via
// service_request_items.part_code ↔ totvs_order_items.product/
// totvs_stock.product_code, ver getVendaQuantidadePorCodigoNoPeriodo/
// getCustoUnitarioPorCodigo em vendasProduto.ts) pra saber "que fração
// do que foi vendido desse produto virou chamado" e "quanto isso custou
// em reposição". Superset de Count (label/count/tag) de propósito --
// openDrilldown (KpisAssistenciaView.tsx) só lê esses 3 campos, então
// continua funcionando sem mudar nada lá.
export type ProductBreakageStat = Count & {
  partCode: string;
  // Unidades físicas trocadas/enviadas (soma de service_request_items.quantity,
  // SEM dedupe) -- base do prejuízo. Diferente de `count` (chamados,
  // deduplicado por request+produto) -- 2 chamados trocando 3 unidades
  // cada contam 6 aqui, mas 2 em `count`.
  itensQuantidade: number;
  // Unidades vendidas desse código no MESMO período do relatório -- 0
  // quando o código é real mas não vendeu nada no período (não confundir
  // com taxaQuebraPct null, ver abaixo).
  vendaQtd: number;
  // null = não dá pra calcular uma taxa que faça sentido: bucket "Não
  // identificado" (sem código), sem venda no período, ou venda abaixo de
  // MIN_VENDA_PARA_TAXA (ruído estatístico de baixo volume) -- UI mostra
  // "N/A" nesses casos, nunca 0% (0% sugeriria "nunca quebra", enganoso).
  taxaQuebraPct: number | null;
  custoUnitario: number | null;
  // Prejuízo de ESTOQUE só (produto: unidades × custo de reposição) --
  // null quando não sabemos o custo (produto sem custo sincronizado, ou
  // bucket "Não identificado", sem código nenhum). Ver prejuizoCobertura
  // em AssistenciaKpiData (mede quantos chamados têm esse valor de
  // verdade) -- renomeado de `prejuizoEstimado` (10/09/2026) quando o
  // custo operacional entrou, pra não confundir os dois.
  prejuizoEstoque: number | null;
  // Estimativa ESTÁTICA de frete/operação por tipo de chamado (valores
  // fixos do Victor, ver CUSTO_OPERACIONAL_POR_TIPO abaixo) -- sempre um
  // número, nunca null: o frete acontece mesmo quando não sabemos o custo
  // do produto. Atribuído a este código toda vez que ele aparece pela
  // primeira vez num chamado (mesmo gatilho de `count`) -- quando um
  // MESMO chamado tem vários códigos diferentes (acontece, confirmado em
  // produção), cada código da linha "ganha" o valor inteiro do chamado, o
  // que pode SOMAR mais que o custo real se você somar todas as linhas à
  // mão. O total do relatório (prejuizoTotalEstimado, AssistenciaKpiData)
  // NÃO tem esse problema -- é calculado direto de `rows` (1 por
  // chamado), sem depender dessa atribuição por linha.
  custoOperacionalEstimado: number;
  // Total da LINHA = (prejuizoEstoque ?? 0) + custoOperacionalEstimado --
  // nunca null (custo operacional sempre existe). Pedido do Victor
  // 10/09/2026: "some ao Prejuízo do Produto os valores operacionais".
  prejuizoEstimado: number;
};

// Custo operacional ESTÁTICO por tipo de chamado -- pedido do Victor
// 10/09/2026: sem custo real de frete/operação no ERP, estimativa fixa
// por chamado, valores dados por ele (não calculados/sincronizados de
// lugar nenhum). "Troca com recolhimento" (rótulo que troca_produto usa
// na tela do motorista, DRIVER_TYPE_LABELS) e "Troca de produto" (rótulo
// do mesmo tipo em REQUEST_TYPE_LABELS) são o MESMO `type` no banco --
// confirmado com o Victor 10/09/2026 que o valor certo é R$120 (o R$150
// que ele também citou pro mesmo tipo não se aplica a nada).
// entrega_produto e envio_recolhimento_peca entraram em 10/09/2026 (ajuste
// fino pós-teste do Victor, depois de ver o relatório com os dois
// zerados) -- valores igualmente estáticos/estimados, mesmo racional dos
// outros 4.
const CUSTO_OPERACIONAL_POR_TIPO: Partial<Record<RequestType, number>> = {
  troca_produto: 120, // "Troca com recolhimento" -- frete de recolhimento + reentrega
  entrega_produto: 90,
  envio_peca: 40, // frete/motoboy
  recolhimento: 60, // recolhimento de peça
  recolhimento_produto: 60, // recolhimento de produto
  envio_recolhimento_peca: 70,
};

// Linha do breakdown "custo operacional por tipo" -- ver
// custoOperacionalPorTipo em AssistenciaKpiData/PrejuizoDetalheModal.tsx.
export type CustoOperacionalPorTipoRow = {
  type: RequestType;
  label: string;
  count: number;
  valorUnitario: number;
  subtotal: number;
};

// Código genérico pra item de chamado sem part_code (24% dos itens de
// entrega/envio no período típico, conferido em produção 10/09/2026) --
// pedido explícito do Victor: mantém esses chamados contando no volume
// geral (não desaparecem do dashboard), só ficam de fora do cálculo de
// % e R$ por falta do dado que liga ao catálogo do Protheus. O custo
// OPERACIONAL desse bucket continua contando normalmente (frete acontece
// mesmo sem saber o código) -- só o prejuízo de ESTOQUE fica null.
const CODIGO_NAO_IDENTIFICADO = "9999";
const LABEL_NAO_IDENTIFICADO = "Produtos Não Identificados (Sem Código Protheus)";

// Abaixo disso, "taxa de quebra" vira ruído -- 1 chamado sobre 1 venda
// dá "100% de quebra" pra um produto que só apareceu uma vez, sem
// significado nenhum pro ranking. Constante isolada e comentada de
// propósito -- fácil de ajustar se o Victor achar o corte alto/baixo
// demais depois de ver o relatório de verdade.
const MIN_VENDA_PARA_TAXA = 5;

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
  // part_code/quantity entraram 10/09/2026 -- base do cruzamento com
  // vendas (Taxa de Quebra/Prejuízo, ver ProductBreakageStat acima).
  type ItemRow = { request_id: string; product: string | null; part_code: string | null; quantity: number | null };
  const items =
    ids.length === 0
      ? []
      : await fetchAllPagesParallel<ItemRow>(
          (from, to) =>
            admin
              .from("service_request_items")
              .select("request_id, product, part_code, quantity", { count: "exact" })
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
    rows.filter((r) => (r.causa_raiz === "erro_conferencia" || r.causa_raiz === "sujeira_conferencia") && r.causa_conferente),
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
  // Agregação por part_code (Taxa de Quebra/Prejuízo, 10/09/2026) -- Map
  // própria, separada de produtoCount acima (que agrupa por DESCRIÇÃO
  // livre, não por código): um mesmo código pode ter descrições digitadas
  // diferentes de chamado pra chamado, e a descrição exibida aqui é só a
  // PRIMEIRA vista (rótulo, não chave de agrupamento).
  const codigoPorChamado = new Set<string>();
  const breakagePorCodigo = new Map<string, { label: string; count: number; itensQuantidade: number; custoOperacionalEstimado: number }>();
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

    const codigo = item.part_code?.trim() || CODIGO_NAO_IDENTIFICADO;
    const codigoDedupeKey = `${item.request_id}::${codigo}`;
    const breakageEntry = breakagePorCodigo.get(codigo) ?? {
      label: codigo === CODIGO_NAO_IDENTIFICADO ? LABEL_NAO_IDENTIFICADO : item.product,
      count: 0,
      itensQuantidade: 0,
      custoOperacionalEstimado: 0,
    };
    // itensQuantidade soma toda linha (sem dedupe -- unidade física de
    // verdade), `count` só cresce uma vez por chamado (mesmo dedupe de
    // produtoCount acima, base da Taxa de Quebra).
    breakageEntry.itensQuantidade += item.quantity ?? 1;
    if (!codigoPorChamado.has(codigoDedupeKey)) {
      codigoPorChamado.add(codigoDedupeKey);
      breakageEntry.count += 1;
      // Custo operacional do TIPO do chamado (ver CUSTO_OPERACIONAL_POR_TIPO)
      // -- atribuído à linha desse código (ver nota de possível
      // sobreposição em ProductBreakageStat.custoOperacionalEstimado
      // acima; o total do relatório não usa essa soma por linha).
      breakageEntry.custoOperacionalEstimado += CUSTO_OPERACIONAL_POR_TIPO[parentRow.type] ?? 0;
      const breakageTag = `produto_quebra:${codigo}`;
      (ticketsByTag[breakageTag] ??= []).push(toReportRowItem(parentRow));
    }
    breakagePorCodigo.set(codigo, breakageEntry);

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

  // Taxa de Quebra / Prejuízo de Estoque (10/09/2026) -- cruza os códigos
  // vistos acima com venda do MESMO período. Converte `range` (Date | null
  // / Date, ver dateRange.ts) pro formato YYYY-MM-DD que
  // vendasProduto.ts espera; `range.from === null` = "desde sempre", usa
  // a data mais antiga já sincronizada como piso (getEarliestSyncedOrderDate,
  // mesmo recurso que a tela de Vendas usa pra avisar período fora do que
  // o sync cobre).
  const codigosReais = [...breakagePorCodigo.keys()].filter((c) => c !== CODIGO_NAO_IDENTIFICADO);
  const vendaRangeFrom = range.from
    ? range.from.toISOString().slice(0, 10)
    : ((await getEarliestSyncedOrderDate()) ?? range.to.toISOString().slice(0, 10));
  const vendaRange = { from: vendaRangeFrom, to: range.to.toISOString().slice(0, 10) };
  const [vendaQtdPorCodigo, custoPorCodigo] = await Promise.all([
    getVendaQuantidadePorCodigoNoPeriodo(codigosReais, vendaRange),
    getCustoUnitarioPorCodigo(codigosReais),
  ]);

  let prejuizoEstoqueTotal = 0;
  let chamadosComCusto = 0;
  const byProductBreakageAll: ProductBreakageStat[] = [...breakagePorCodigo.entries()].map(([codigo, entry]) => {
    const isNaoIdentificado = codigo === CODIGO_NAO_IDENTIFICADO;
    const vendaQtd = isNaoIdentificado ? 0 : (vendaQtdPorCodigo.get(codigo) ?? 0);
    const custoUnitario = isNaoIdentificado ? null : (custoPorCodigo.get(codigo) ?? null);
    // N/A (não 0%) quando: sem código, sem venda no período, ou venda
    // abaixo de MIN_VENDA_PARA_TAXA (ruído de baixo volume) -- ver
    // comentário em ProductBreakageStat/MIN_VENDA_PARA_TAXA acima.
    const taxaQuebraPct = !isNaoIdentificado && vendaQtd >= MIN_VENDA_PARA_TAXA ? (entry.count / vendaQtd) * 100 : null;
    const prejuizoEstoque = custoUnitario != null ? entry.itensQuantidade * custoUnitario : null;
    if (prejuizoEstoque != null) {
      prejuizoEstoqueTotal += prejuizoEstoque;
      chamadosComCusto += entry.count;
    }
    return {
      label: entry.label,
      count: entry.count,
      tag: `produto_quebra:${codigo}`,
      partCode: codigo,
      itensQuantidade: entry.itensQuantidade,
      vendaQtd,
      taxaQuebraPct,
      custoUnitario,
      prejuizoEstoque,
      custoOperacionalEstimado: entry.custoOperacionalEstimado,
      prejuizoEstimado: (prejuizoEstoque ?? 0) + entry.custoOperacionalEstimado,
    };
  });
  // Custo operacional TOTAL (e por tipo) -- calculado direto de `rows` (1
  // linha por chamado, sem depender de item/código nenhum), não da soma
  // das linhas de byProductBreakageAll acima (que pode sobrepor quando um
  // chamado tem vários códigos, ver comentário em
  // ProductBreakageStat.custoOperacionalEstimado). Esses aqui são os
  // valores certos pro card de destaque e pro detalhamento ao clicar
  // (PrejuizoDetalheModal.tsx, pedido do Victor 10/09/2026: "mostre os
  // valores detalhados e como chegou a esse valor").
  const chamadosPorTipoMap = new Map<RequestType, number>();
  for (const r of rows) {
    chamadosPorTipoMap.set(r.type, (chamadosPorTipoMap.get(r.type) ?? 0) + 1);
  }
  const custoOperacionalPorTipo: CustoOperacionalPorTipoRow[] = [...chamadosPorTipoMap.entries()]
    .map(([type, count]) => {
      const valorUnitario = CUSTO_OPERACIONAL_POR_TIPO[type] ?? 0;
      return { type, label: REQUEST_TYPE_LABELS[type] ?? type, count, valorUnitario, subtotal: count * valorUnitario };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
  const custoOperacionalTotal = custoOperacionalPorTipo.reduce((soma, r) => soma + r.subtotal, 0);
  const prejuizoTotalEstimado = prejuizoEstoqueTotal + custoOperacionalTotal;
  // Ordena: taxa calculável primeiro (maior % primeiro), depois quem
  // ficou N/A por falta de venda/volume, "Não identificado" sempre por
  // último de todos -- é o bucket menos útil pra essa métrica específica,
  // mesmo aparecendo em volume de chamados normal em todo o resto da tela.
  byProductBreakageAll.sort((a, b) => {
    if (a.partCode === CODIGO_NAO_IDENTIFICADO) return b.partCode === CODIGO_NAO_IDENTIFICADO ? 0 : 1;
    if (b.partCode === CODIGO_NAO_IDENTIFICADO) return -1;
    if (a.taxaQuebraPct != null && b.taxaQuebraPct != null) return b.taxaQuebraPct - a.taxaQuebraPct;
    if (a.taxaQuebraPct != null) return -1;
    if (b.taxaQuebraPct != null) return 1;
    return b.count - a.count;
  });
  const byProductBreakage = byProductBreakageAll.slice(0, PRODUCT_RANKING_LIMIT);
  // Top por PREJUÍZO (R$), não por taxa de quebra (%) -- pro detalhamento
  // do card de destaque (PrejuizoDetalheModal.tsx, "como chegou a esse
  // valor"). Calculado a partir de byProductBreakageAll (o conjunto
  // INTEIRO, não o `byProductBreakage` já cortado em 20 por %) -- um
  // produto caro mas com taxa de quebra baixa (poucos chamados sobre
  // muita venda) pode nem entrar no top 20 por % e ainda assim ser um dos
  // maiores prejuízos em R$; usar o ranking por % aqui esconderia ele.
  const byProductBreakageTopValor = [...byProductBreakageAll]
    .sort((a, b) => b.prejuizoEstimado - a.prejuizoEstimado)
    .slice(0, PRODUCT_RANKING_LIMIT);
  // Cobertura do custo de PRODUTO só (prejuizoEstoque) -- o custo
  // OPERACIONAL não precisa de badge de cobertura, é sempre um valor
  // conhecido por construção (estimativa fixa por tipo, ver
  // CUSTO_OPERACIONAL_POR_TIPO), mesmo quando 0 pros tipos sem valor
  // definido ainda.
  const prejuizoCobertura: Coverage = {
    withValue: chamadosComCusto,
    total: rows.length,
    pct: rows.length > 0 ? Math.round((chamadosComCusto / rows.length) * 100) : 0,
  };

  return {
    totalChamados: rows.length,
    dailyVolume,
    distinctProductCount: produtoCount.size,
    byProduct,
    byProductBreakage,
    byProductBreakageTopValor,
    prejuizoTotalEstimado,
    prejuizoEstoqueTotalEstimado: prejuizoEstoqueTotal,
    custoOperacionalTotalEstimado: custoOperacionalTotal,
    custoOperacionalPorTipo,
    prejuizoCobertura,
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
