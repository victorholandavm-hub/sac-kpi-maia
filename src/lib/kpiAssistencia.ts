import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import type { DateRange, RangePreset } from "./dateRange";
import type { Count, Coverage, DayCount } from "./kpi";
import { REQUEST_TYPE_LABELS, CAUSA_RAIZ_LABELS, DELIVERY_REQUEST_TYPES, ALL_REQUEST_TYPES } from "./assistenciaLabels";
import { ROTA_LABELS, type Rota } from "./rotas";
import {
  classificarProdutoAssistencia,
  familiaLogisticaDaCategoria,
  getVendaQuantidadePorCodigoNoPeriodo,
  getCustoUnitarioPorCodigo,
  getCustoMedioPorCategoria,
  getEarliestSyncedOrderDate,
  getVendasCountPorLoja,
} from "./vendasProduto";
import { listStores, type RequestType, type RequestStatus, type ReportRowItem } from "./serviceRequests";

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

// `productSummary` opcional -- pedido do Victor 10/09/2026: "preciso que
// apareça... qual é o produto daquela notificação" no drill-down (ver
// AssistenciaTicketsModal.tsx). Vem de `produtosPorChamado`
// (getAssistenciaKpiData abaixo, montado a partir de service_request_items
// já buscado); `aggregate()` e os pushes manuais no loop de produto
// passam isso -- sem 3º argumento, fica `undefined` (mesmo efeito de
// antes, o modal só não mostra a linha).
function toReportRowItem(r: RequestRow, productSummary?: string | null): ReportRowItem {
  return {
    id: r.id,
    ticketNumber: r.ticket_number,
    type: r.type,
    status: r.status,
    clientName: r.client_name,
    storeName: r.stores?.name ?? r.store_id,
    createdAt: r.created_at,
    reason: r.reason,
    productSummary,
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
  // Achado 19/09/2026 (pedido do Victor: "ewerton e everton, são a mesma
  // pessoa") -- grafia genuinamente diferente (V/W), não só caixa.
  EWERTON: "EVERTON",
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
  tagPrefix: string,
  produtosPorChamado: Map<string, string>
): Count[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = keyFn(r);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const tag = `${tagPrefix}:${key}`;
    (ticketsByTag[tag] ??= []).push(toReportRowItem(r, produtosPorChamado.get(r.id)));
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ label: labelFn(key), count, tag: `${tagPrefix}:${key}` }))
    .sort((a, b) => b.count - a.count);
}

// Meta ideal do "% de assistência" (chamados de assistência / vendas do
// período * 100) -- pedido do Victor 19/09/2026, print de referência:
// Atual 5,5%, Meta de Curto Prazo (3 meses) 4,2%, Meta de Médio Prazo
// (Ideal) < 3,0%. Só a meta ideal (mais rígida) entra como constante -- é
// ela que decide o badge vermelho em KpisAssistenciaView.tsx quando o
// percentual atual fica acima.
export const ASSISTENCIA_TAXA_META_IDEAL_PCT = 3.0;

export type AssistenciaKpiData = {
  totalChamados: number;
  // Vendas (TOTVS) no mesmo período selecionado -- pedido do Victor
  // 18/09/2026 ("em relação a quantas vendas?"), mesma soma de
  // byStoreVendaVsAssistencia (vendasPorLoja) abaixo, só sem quebrar por
  // loja. Contexto de referência ao lado de totalChamados.
  totalVendasNoPeriodo: number;
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
  // "Vendas x Assistência Técnica" por loja -- pedido do Victor 14/09/2026:
  // "quero ver o percentual de quantidade de vendas (entregas) x
  // quantidade de assistencia tecnica". Cruza DUAS fontes independentes
  // pro MESMO período: vendas vêm do Protheus (totvs_orders, sincronizado
  // via TOTVS Sync), chamados vêm do sistema integrado (service_requests,
  // ver VENDA_VS_ASSISTENCIA_TYPES abaixo -- quase todos os tipos, EXCETO
  // montagem/desmontagem, pedido do Victor no mesmo dia: "montagem e
  // desmontagem não devem entrar nesses números", são serviço contratado
  // à parte, não um sinal de problema pós-venda como o resto). Diferente
  // de `byStore` acima -- aquele é só contagem de chamados
  // (DELIVERY_REQUEST_TYPES, escopo mais estreito do resto desta tela, ver
  // comentário no topo do arquivo); esse aqui é um cruzamento novo, com
  // escopo de tipo próprio.
  byStoreVendaVsAssistencia: VendaVsAssistenciaStat[];
  // Chave = `tag` de cada Count acima (ex.: "rota:praia") -- ver
  // AssistenciaTicketsModal.tsx.
  ticketsByTag: Record<string, ReportRowItem[]>;
};

export type VendaVsAssistenciaStat = {
  storeId: string;
  storeName: string;
  vendas: number;
  chamados: number;
  // null quando vendas = 0 no período -- sem denominador, não dá pra
  // calcular um percentual que signifique alguma coisa (não é "0%").
  percentual: number | null;
  // Chamados por trás de `chamados` -- pedido do Victor 14/09/2026: clicar
  // no percentual abre a lista deles, agrupada por tipo (ver
  // VendaVsAssistenciaBoardModal.tsx). Mais recente primeiro. Vazio (não
  // omitido) quando `chamados` é 0 -- sempre length === chamados.
  tickets: ReportRowItem[];
};

// Linha crua da busca "todos os tipos, todas as lojas" que alimenta
// byStoreVendaVsAssistencia acima (ver getAssistenciaKpiData) -- só os
// campos que ReportRowItem precisa, sem os extras de RequestRow (causa
// raiz, motorista etc., que essa métrica não usa).
type ChamadoTodosTiposRow = {
  id: string;
  ticket_number: number;
  type: RequestType;
  status: RequestStatus;
  store_id: string;
  client_name: string | null;
  created_at: string;
  reason: string | null;
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
  // Custo exato do Protheus (totvs_stock.unit_cost) quando existe; senão o
  // custo MÉDIO da categoria do produto (getCustoMedioPorCategoria,
  // vendasProduto.ts -- pedido do Victor 21/09/2026: "não some R$0").
  // null só no bucket "Não identificado" (sem código nenhum pra
  // classificar) -- ver prejuizoCobertura em AssistenciaKpiData, que mede
  // só a fatia com custo EXATO (não a estimada por categoria).
  custoUnitario: number | null;
  // Prejuízo de ESTOQUE só (produto: quantidade AJUSTADA -- ver
  // PRODUCT_COST_MULTIPLIER_POR_TIPO, 0 pra entrega/0,7 pra troca e
  // recolhimento de produto/1 pro resto -- × custo de reposição, exato ou
  // por categoria). null só quando custoUnitario é null (bucket "Não
  // identificado"). Ver prejuizoCobertura em AssistenciaKpiData --
  // renomeado de `prejuizoEstimado` (10/09/2026) quando o custo
  // operacional entrou, pra não confundir os dois.
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

// Custo logístico REAL diluído -- pedido do Victor 21/09/2026: "descobrimos
// os custos reais da nossa operação... 1 caminhão próprio, 1 motorista, 2
// ajudantes, média fixa de 13 chamados/dia de rota". Substitui a matriz de
// estimativas por tipo de 10-21/09/2026 (R$120/90/40/60/60/70, cada uma um
// palpite separado) por um valor ÚNICO real -- a mesma frota atende
// qualquer um dos 6 tipos de DELIVERY_REQUEST_TYPES (troca, entrega,
// envio/recolhimento de peça ou produto), então todos pagam o mesmo frete
// diluído. Sem diferença nenhuma por tipo mais -- CUSTO_OPERACIONAL_POR_TIPO
// (Record por tipo) saiu de propósito, não faz mais sentido existir.
const CUSTO_LOGISTICO_BASE = 38.05;

// Multiplicador de volume/porte -- pedido do Victor 21/09/2026 (mesmo dia,
// 2ª mensagem): "itens grandes como sofás e colchões ocupam muito mais
// espaço no baú e exigem esforço máximo dos ajudantes" -- R$38,05 × 1,5 =
// R$57,07. Reaproveita familiaLogisticaDaCategoria (vendasProduto.ts, já
// usada em /vendas pro mesmo conceito de "ocupa muito espaço no
// caminhão?") -- "grande"/"medio" aplica o multiplicador, "pequeno"
// mantém o frete seco. Vale pra QUALQUER um dos 6 tipos agora (não só um
// subconjunto) -- o frete base já é o mesmo pra todos.
const MULTIPLICADOR_PRODUTO_VOLUMOSO = 1.5;

// Fator de Recuperação de Ativo -- pedido do Victor 21/09/2026: produto
// que RETORNA pra fábrica/assistência (troca, recolhimento de produto) tem
// valor residual de reaproveitamento (matéria-prima, saldão), não é perda
// total do custo de reposição do Protheus -- 30% de desconto no prejuízo
// de ESTOQUE (não no operacional). "Entrega de produto" (item que faltou
// na entrega original, já vendido/computado antes) não perde produto
// NENHUM -- custo de estoque zerado, só o operacional acima conta.
const FATOR_RECUPERACAO_ATIVO = 0.7;
const PRODUCT_COST_MULTIPLIER_POR_TIPO: Partial<Record<RequestType, number>> = {
  entrega_produto: 0,
  troca_produto: FATOR_RECUPERACAO_ATIVO,
  recolhimento_produto: FATOR_RECUPERACAO_ATIVO,
};
function productCostMultiplier(type: RequestType): number {
  return PRODUCT_COST_MULTIPLIER_POR_TIPO[type] ?? 1;
}

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

// Tipos que contam como "assistência técnica" no cruzamento Vendas x
// Assistência (ver byStoreVendaVsAssistencia) -- ALL_REQUEST_TYPES sem
// montagem/desmontagem. Pedido do Victor 14/09/2026, mesmo dia da
// métrica: "montagem e desmontagem não devem entrar nesses números" --
// são serviço de instalação contratado à parte (o cliente PEDE montagem,
// não é um problema pós-venda como troca de peça/vistoria/troca de
// produto), então contar eles infla o percentual sem significar "algo
// deu errado". `.filter` em vez de reescrever a lista na mão -- se
// ALL_REQUEST_TYPES ganhar um tipo novo um dia, ele já entra aqui
// automaticamente (a exclusão fica só nos dois nomeados, não numa lista
// positiva que alguém precisaria lembrar de atualizar).
const VENDA_VS_ASSISTENCIA_TYPES = ALL_REQUEST_TYPES.filter((t) => t !== "montagem" && t !== "desmontagem");

// Achado 21/09/2026 (pedido do Victor: "quando eu vou de kpis do sac pra
// assistencia, está demorando muito") -- essa função varre service_requests
// + service_request_items INTEIROS (paginado) e ainda cruza com Protheus
// (custo/vendas por produto) pro Prejuízo Estimado, sem cache nenhum --
// refeita do zero em TODA navegação pra /kpis-assistencia, mesmo pedindo o
// mesmo período de segundos atrás. Mesmo remédio já aplicado em kpi.ts
// (getKpiData) 17/09/2026 pro mesmo sintoma em /kpis: unstable_cache com
// chave "baldeada" de 5 min (range.to muda a cada milissegundo, só o balde
// garante cache hit).
const ASSISTENCIA_CACHE_BUCKET_MS = 5 * 60 * 1000;

export async function getAssistenciaKpiData(range: DateRange): Promise<AssistenciaKpiData> {
  const bucketedTo = new Date(Math.floor(range.to.getTime() / ASSISTENCIA_CACHE_BUCKET_MS) * ASSISTENCIA_CACHE_BUCKET_MS);
  return getAssistenciaKpiDataCached(range.preset, range.from ? range.from.toISOString() : null, bucketedTo.toISOString());
}

const getAssistenciaKpiDataCached = unstable_cache(
  async (preset: RangePreset | "custom", fromIso: string | null, toIso: string): Promise<AssistenciaKpiData> => {
  const range: DateRange = { preset, from: fromIso ? new Date(fromIso) : null, to: new Date(toIso) };
  const admin = getSupabaseAdmin();

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

  // Produto(s) por chamado, já formatado pro drill-down -- pedido do
  // Victor 10/09/2026: "preciso que apareça... qual é o produto daquela
  // notificação" ao clicar numa barra (ex.: "Conferente que mais
  // errou"). Pré-passe separado (não dentro do loop principal mais
  // abaixo, que também usa `items`) porque precisa do chamado INTEIRO
  // (todos os itens juntos) pronto ANTES de qualquer toReportRowItem
  // rodar -- inclusive dentro do próprio loop principal, que processa um
  // item de cada vez.
  const produtosPorChamado = new Map<string, string>();
  // Chamado tem produto "volumoso" (categoria grande/médio, ver
  // MULTIPLICADOR_PRODUTO_VOLUMOSO acima) -- basta UM item do chamado
  // bater pra ele todo contar como volumoso (o caminhão vai de qualquer
  // jeito). Montado no mesmo pré-passe acima (precisa de TODOS os itens
  // de cada chamado prontos antes do loop principal usar isso pro custo
  // operacional).
  const chamadosComProdutoVolumoso = new Set<string>();
  {
    const itensPorChamado = new Map<string, string[]>();
    for (const item of items) {
      if (!item.product) continue;
      const label = item.quantity && item.quantity > 1 ? `${item.quantity}x ${item.product}` : item.product;
      const lista = itensPorChamado.get(item.request_id) ?? [];
      lista.push(label);
      itensPorChamado.set(item.request_id, lista);

      const categoria = classificarProdutoAssistencia(item.product);
      if (categoria.key !== "peca_avulsa" && familiaLogisticaDaCategoria(categoria.key) !== "pequeno") {
        chamadosComProdutoVolumoso.add(item.request_id);
      }
    }
    for (const [id, produtos] of itensPorChamado) produtosPorChamado.set(id, produtos.join(", "));
  }

  // Custo operacional de UM chamado -- CUSTO_LOGISTICO_BASE (R$38,05) x 1,5
  // se o chamado tiver produto volumoso, senão o valor seco. Todo `rows` já
  // é DELIVERY_REQUEST_TYPES (filtro da query acima) -- não precisa checar
  // tipo, a frota própria atende os 6 tipos igual. Usada tanto no
  // breakdown por código (abaixo) quanto no total/por-tipo (mais abaixo).
  function custoOperacionalDoChamado(requestId: string): number {
    const volumoso = chamadosComProdutoVolumoso.has(requestId);
    return volumoso ? CUSTO_LOGISTICO_BASE * MULTIPLICADOR_PRODUTO_VOLUMOSO : CUSTO_LOGISTICO_BASE;
  }

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

  const byRota = aggregate(rows, (r) => r.rota, (k) => ROTA_LABELS[k as Rota] ?? k, ticketsByTag, "rota", produtosPorChamado);
  const byStore = aggregate(rows, (r) => r.stores?.name ?? r.store_id, (k) => k, ticketsByTag, "loja", produtosPorChamado);
  const byType = aggregate(rows, (r) => r.type, (k) => REQUEST_TYPE_LABELS[k as RequestType] ?? k, ticketsByTag, "tipo", produtosPorChamado);
  const byCausaRaiz = aggregate(rows, (r) => r.causa_raiz, (k) => CAUSA_RAIZ_LABELS[k] ?? k, ticketsByTag, "causa", produtosPorChamado);
  // Quem registrou o chamado (requested_by, ver toSummary em
  // serviceRequests.ts pro mesmo fallback join→texto) -- "atendente" no
  // sentido de quem atendeu/criou a notificação, não quem tá responsável
  // por ela agora (esse último muda de dono com claimRequest).
  const byAgent = aggregate(rows, atendenteName, (k) => k, ticketsByTag, "atendente", produtosPorChamado);
  // Ver titleCase acima -- agrupa por nome em caixa alta (mesma pessoa,
  // caixa diferente, conta junto), exibe sempre em Title Case.
  const byConferente = aggregate(
    rows.filter((r) => (r.causa_raiz === "erro_conferencia" || r.causa_raiz === "sujeira_conferencia") && r.causa_conferente),
    (r) => canonicalConferenteKey(r.causa_conferente!),
    titleCase,
    ticketsByTag,
    "conferente",
    produtosPorChamado
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
    "motorista",
    produtosPorChamado
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
  const breakagePorCodigo = new Map<
    string,
    { label: string; count: number; itensQuantidade: number; itensQuantidadeAjustada: number; custoOperacionalEstimado: number }
  >();
  for (const item of items) {
    if (!item.product) continue;
    const parentRow = rowById.get(item.request_id);
    if (!parentRow) continue;

    const dedupeKey = `${item.request_id}::${item.product}`;
    if (!produtoPorChamado.has(dedupeKey)) {
      produtoPorChamado.add(dedupeKey);
      produtoCount.set(item.product, (produtoCount.get(item.product) ?? 0) + 1);
      const produtoTag = `produto:${item.product}`;
      (ticketsByTag[produtoTag] ??= []).push(toReportRowItem(parentRow, produtosPorChamado.get(parentRow.id)));
    }

    const codigo = item.part_code?.trim() || CODIGO_NAO_IDENTIFICADO;
    const codigoDedupeKey = `${item.request_id}::${codigo}`;
    const breakageEntry = breakagePorCodigo.get(codigo) ?? {
      label: codigo === CODIGO_NAO_IDENTIFICADO ? LABEL_NAO_IDENTIFICADO : item.product,
      count: 0,
      itensQuantidade: 0,
      itensQuantidadeAjustada: 0,
      custoOperacionalEstimado: 0,
    };
    // itensQuantidade soma toda linha (sem dedupe -- unidade física de
    // verdade), `count` só cresce uma vez por chamado (mesmo dedupe de
    // produtoCount acima, base da Taxa de Quebra). itensQuantidadeAjustada
    // é a mesma soma, mas pesada pelo Fator de Recuperação de Ativo do TIPO
    // do chamado (productCostMultiplier, ver PRODUCT_COST_MULTIPLIER_POR_TIPO
    // acima) -- base do prejuízo de ESTOQUE mais abaixo, não da exibição
    // de quantidade física (que continua usando itensQuantidade cru).
    breakageEntry.itensQuantidade += item.quantity ?? 1;
    breakageEntry.itensQuantidadeAjustada += (item.quantity ?? 1) * productCostMultiplier(parentRow.type);
    if (!codigoPorChamado.has(codigoDedupeKey)) {
      codigoPorChamado.add(codigoDedupeKey);
      breakageEntry.count += 1;
      // Custo operacional do TIPO do chamado, já com o multiplicador de
      // volume se aplicável (ver custoOperacionalDoChamado acima) --
      // atribuído à linha desse código (ver nota de possível sobreposição
      // em ProductBreakageStat.custoOperacionalEstimado acima; o total do
      // relatório não usa essa soma por linha).
      breakageEntry.custoOperacionalEstimado += custoOperacionalDoChamado(parentRow.id);
      const breakageTag = `produto_quebra:${codigo}`;
      (ticketsByTag[breakageTag] ??= []).push(toReportRowItem(parentRow, produtosPorChamado.get(parentRow.id)));
    }
    breakagePorCodigo.set(codigo, breakageEntry);

    if (parentRow.causa_raiz === "defeito_fabricacao" && !produtoDefeitoPorChamado.has(dedupeKey)) {
      produtoDefeitoPorChamado.add(dedupeKey);
      produtoDefeitoCount.set(item.product, (produtoDefeitoCount.get(item.product) ?? 0) + 1);
      const produtoDefeitoTag = `produto_defeito:${item.product}`;
      (ticketsByTag[produtoDefeitoTag] ??= []).push(toReportRowItem(parentRow, produtosPorChamado.get(parentRow.id)));
    }

    const grupo = classificarProdutoAssistencia(item.product);
    const grupoDedupeKey = `${item.request_id}::${grupo.key}`;
    if (!grupoPorChamado.has(grupoDedupeKey)) {
      grupoPorChamado.add(grupoDedupeKey);
      const grupoEntry = grupoCount.get(grupo.key) ?? { label: grupo.label, count: 0 };
      grupoEntry.count++;
      grupoCount.set(grupo.key, grupoEntry);
      const grupoTag = `grupo:${grupo.key}`;
      (ticketsByTag[grupoTag] ??= []).push(toReportRowItem(parentRow, produtosPorChamado.get(parentRow.id)));
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
  // Cuidado de fuso -- achado ao revisar esses números 14/09/2026: "to"
  // customizado (RangePicker, De/Até) chega como "YYYY-MM-DD" puro, e
  // `new Date("2026-09-14")` do JS interpreta isso como meia-noite EM UTC
  // (não meia-noite no Brasil, UTC-3) -- então `toIso` (usado no `rows`
  // principal acima, escopo DELIVERY_REQUEST_TYPES) corta às 21h do dia
  // ANTERIOR no horário do Brasil, perdendo quase o dia inteiro de "Até"
  // pra quem escolhe um período customizado. `vendaRange.to`, por outro
  // lado, é comparado contra `issue_date` (coluna DATE, sem hora) -- não
  // sofre esse corte, sempre inclui o dia inteiro. Comparar chamados
  // (created_at, com hora) contra vendas (issue_date, sem hora) usando
  // bordas DIFERENTES faria o numerador e o denominador cobrirem janelas
  // de dias diferentes -- exatamente o tipo de inconsistência que
  // invalidaria o percentual. Corrigido aqui recalculando bordas
  // ALINHADAS ao mesmo dia-calendário de `vendaRange` (não reusa
  // fromIso/toIso do `rows` acima, que continua como estava -- mudar o
  // corte do resto da página é remexer em números que o Victor já
  // conferiu noutros gráficos, fora do escopo desse cruzamento).
  const chamadosFromIso = `${vendaRange.from}T00:00:00.000Z`;
  const chamadosToIso = `${vendaRange.to}T23:59:59.999Z`;
  const [vendaQtdPorCodigo, custoPorCodigo, custoMedioPorCategoria, vendasPorLoja, chamadosTodosTiposRows, allStores] = await Promise.all([
    getVendaQuantidadePorCodigoNoPeriodo(codigosReais, vendaRange),
    getCustoUnitarioPorCodigo(codigosReais),
    // Ponto cego (código sem custo sincronizado) -- pedido do Victor
    // 21/09/2026: em vez de R$0, usa o custo médio da categoria do
    // produto (ver getCustoMedioPorCategoria/vendasProduto.ts).
    getCustoMedioPorCategoria(),
    // "Vendas x Assistência Técnica" (ver VendaVsAssistenciaStat acima) --
    // denominador, do Protheus.
    getVendasCountPorLoja(vendaRange),
    // Numerador -- VENDA_VS_ASSISTENCIA_TYPES (não DELIVERY_REQUEST_TYPES
    // de `rows`, ver comentário em byStoreVendaVsAssistencia), mesma
    // janela de dias de `vendaRange` (ver chamadosFromIso/chamadosToIso
    // acima -- não fromIso/toIso do `rows` principal, que usa uma borda
    // ligeiramente diferente). Cancelada fica de fora, mesmo motivo/filtro
    // de `rows` acima (nunca virou assistência de verdade). Linha inteira
    // (não só store_id) -- pedido do Victor 14/09/2026: clicar no
    // percentual abre a lista desses chamados (ver
    // VendaVsAssistenciaStat.tickets abaixo).
    fetchAllPagesParallel<ChamadoTodosTiposRow>(
      (from, to) =>
        admin
          .from("service_requests")
          .select("id, ticket_number, type, status, store_id, client_name, created_at, reason", { count: "exact" })
          .in("type", VENDA_VS_ASSISTENCIA_TYPES)
          .not("status", "eq", "cancelada")
          .gte("created_at", chamadosFromIso)
          .lte("created_at", chamadosToIso)
          .range(from, to) as unknown as PromiseLike<PagedQueryResult<ChamadoTodosTiposRow>>,
      { pageSize: PAGE_SIZE }
    ),
    // Nomes de TODAS as lojas -- achado ao revisar esses números
    // 14/09/2026: resolver o nome só a partir do join de `chamadosTodosTiposRows`
    // (como a primeira versão fazia) deixa sem nome exatamente a loja que
    // teve vendas mas ZERO chamados no período -- o melhor caso possível,
    // mas ficava mostrando o código cru da filial (ex.: "213") em vez do
    // nome. `listStores()` (serviceRequests.ts) já é cacheada 60s e cobre
    // TODAS as lojas, com ou sem chamado.
    listStores(),
  ]);
  const storeNameById = new Map(allStores.map((s) => [s.id, s.name]));
  // Produto(s) desses chamados -- pedido do Victor 14/09/2026: "coloque o
  // nome do produto também" no resumo (TicketResumoModal.tsx). Mesmo
  // formato/fonte de `produtosPorChamado` acima (service_request_items),
  // busca PRÓPRIA -- não dá pra reaproveitar aquele map, construído só
  // pros ids de `rows` (escopo DELIVERY_REQUEST_TYPES, período com borda
  // diferente, ver comentário em chamadosFromIso/chamadosToIso) --
  // `chamadosTodosTiposRows` é um conjunto de chamados independente.
  const chamadoVendaIds = chamadosTodosTiposRows.map((r) => r.id);
  const chamadoVendaItems =
    chamadoVendaIds.length === 0
      ? []
      : await fetchAllPagesParallel<{ request_id: string; product: string | null; quantity: number | null }>(
          (from, to) =>
            admin
              .from("service_request_items")
              .select("request_id, product, quantity", { count: "exact" })
              .in("request_id", chamadoVendaIds)
              .range(from, to) as unknown as PromiseLike<PagedQueryResult<{ request_id: string; product: string | null; quantity: number | null }>>,
          { pageSize: PAGE_SIZE }
        );
  const produtosPorChamadoVenda = new Map<string, string>();
  {
    const itensPorChamado = new Map<string, string[]>();
    for (const item of chamadoVendaItems) {
      if (!item.product) continue;
      const label = item.quantity && item.quantity > 1 ? `${item.quantity}x ${item.product}` : item.product;
      const lista = itensPorChamado.get(item.request_id) ?? [];
      lista.push(label);
      itensPorChamado.set(item.request_id, lista);
    }
    for (const [id, produtos] of itensPorChamado) produtosPorChamadoVenda.set(id, produtos.join(", "));
  }
  const chamadosPorLoja = new Map<string, number>();
  const ticketsPorLoja = new Map<string, ReportRowItem[]>();
  for (const r of chamadosTodosTiposRows) {
    chamadosPorLoja.set(r.store_id, (chamadosPorLoja.get(r.store_id) ?? 0) + 1);
    const lista = ticketsPorLoja.get(r.store_id) ?? [];
    lista.push({
      id: r.id,
      ticketNumber: r.ticket_number,
      type: r.type,
      status: r.status,
      clientName: r.client_name,
      storeName: storeNameById.get(r.store_id) ?? r.store_id,
      createdAt: r.created_at,
      reason: r.reason,
      productSummary: produtosPorChamadoVenda.get(r.id),
    });
    ticketsPorLoja.set(r.store_id, lista);
  }
  // Mais recente primeiro -- pedido do Victor 14/09/2026, mesma ordem que
  // faz sentido pra "lista de notificações" (ver VendaVsAssistenciaBoardModal.tsx).
  for (const lista of ticketsPorLoja.values()) lista.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  // União das duas fontes -- uma loja pode ter vendas sem NENHUM chamado no
  // período (ótimo sinal, não motivo pra sumir da lista) ou, mais raro,
  // aparecer só no lado de chamados (loja sem venda sincronizada ainda).
  const lojaIds = new Set([...vendasPorLoja.keys(), ...chamadosPorLoja.keys()]);
  const byStoreVendaVsAssistencia: VendaVsAssistenciaStat[] = [...lojaIds]
    .map((storeId) => {
      const vendas = vendasPorLoja.get(storeId) ?? 0;
      const chamados = chamadosPorLoja.get(storeId) ?? 0;
      return {
        storeId,
        storeName: storeNameById.get(storeId) ?? storeId,
        vendas,
        chamados,
        percentual: vendas > 0 ? (chamados / vendas) * 100 : null,
        tickets: ticketsPorLoja.get(storeId) ?? [],
      };
    })
    .sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1));

  let prejuizoEstoqueTotal = 0;
  // "Rastreado" = custo EXATO do código (totvs_stock.unit_cost direto),
  // não a estimativa por categoria abaixo -- é o que prejuizoCobertura
  // (badge "X% com custo de produto rastreado") mede, pra continuar
  // avisando quanto do total é dado real vs. estimado, mesmo agora que
  // "sem custo exato" não vira mais R$0.
  let chamadosComCustoExato = 0;
  const byProductBreakageAll: ProductBreakageStat[] = [...breakagePorCodigo.entries()].map(([codigo, entry]) => {
    const isNaoIdentificado = codigo === CODIGO_NAO_IDENTIFICADO;
    const vendaQtd = isNaoIdentificado ? 0 : (vendaQtdPorCodigo.get(codigo) ?? 0);
    const custoExato = isNaoIdentificado ? null : (custoPorCodigo.get(codigo) ?? null);
    // Ponto cego -- pedido do Victor 21/09/2026: código real (não o
    // bucket "Não identificado") sem custo sincronizado usa o custo médio
    // da categoria do produto em vez de R$0 (ver getCustoMedioPorCategoria/
    // vendasProduto.ts).
    const custoUnitario =
      custoExato ?? (isNaoIdentificado ? null : (custoMedioPorCategoria[classificarProdutoAssistencia(entry.label).key] ?? null));
    // N/A (não 0%) quando: sem código, sem venda no período, ou venda
    // abaixo de MIN_VENDA_PARA_TAXA (ruído de baixo volume) -- ver
    // comentário em ProductBreakageStat/MIN_VENDA_PARA_TAXA acima.
    const taxaQuebraPct = !isNaoIdentificado && vendaQtd >= MIN_VENDA_PARA_TAXA ? (entry.count / vendaQtd) * 100 : null;
    // itensQuantidadeAjustada (não itensQuantidade cru) -- já vem pesada
    // pelo Fator de Recuperação de Ativo do tipo do chamado (0 pra
    // entrega_produto, 0,7 pra troca/recolhimento de produto, 1 pro
    // resto -- ver PRODUCT_COST_MULTIPLIER_POR_TIPO).
    const prejuizoEstoque = custoUnitario != null ? entry.itensQuantidadeAjustada * custoUnitario : null;
    if (prejuizoEstoque != null) {
      prejuizoEstoqueTotal += prejuizoEstoque;
    }
    if (custoExato != null) {
      chamadosComCustoExato += entry.count;
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
  // valores detalhados e como chegou a esse valor"). Agrupado por
  // (tipo, volumoso) -- não só tipo -- desde 21/09/2026: um mesmo tipo
  // pode ter chamados no valor padrão E chamados com o multiplicador de
  // 1,5x (MULTIPLICADOR_PRODUTO_VOLUMOSO), então vira 2 linhas em vez de
  // quebrar a conta "subtotal = count × valorUnitario" que o detalhamento
  // depende.
  const custoOperacionalAgg = new Map<string, { type: RequestType; volumoso: boolean; count: number; valorUnitario: number }>();
  for (const r of rows) {
    const volumoso = chamadosComProdutoVolumoso.has(r.id);
    const valorUnitario = custoOperacionalDoChamado(r.id);
    const key = `${r.type}|${volumoso}`;
    const agg = custoOperacionalAgg.get(key) ?? { type: r.type, volumoso, count: 0, valorUnitario };
    agg.count += 1;
    custoOperacionalAgg.set(key, agg);
  }
  const custoOperacionalPorTipo: CustoOperacionalPorTipoRow[] = [...custoOperacionalAgg.values()]
    .map(({ type, volumoso, count, valorUnitario }) => ({
      type,
      label: (REQUEST_TYPE_LABELS[type] ?? type) + (volumoso ? " (produto volumoso, 1,5x)" : ""),
      count,
      valorUnitario,
      subtotal: count * valorUnitario,
    }))
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
  // Cobertura do custo EXATO de PRODUTO só (prejuizoEstoque) -- o custo
  // OPERACIONAL não precisa de badge de cobertura, é sempre um valor
  // conhecido por construção (estimativa fixa por tipo, ver
  // CUSTO_OPERACIONAL_POR_TIPO), mesmo quando 0 pros tipos sem valor
  // definido ainda. Usa chamadosComCustoExato (não conta a estimativa por
  // categoria, ver bloco acima) -- do contrário essa cobertura bateria
  // perto de 100% sempre (quase todo código cai numa categoria com média),
  // escondendo justamente o que é dado real do Protheus vs. estimativa.
  const prejuizoCobertura: Coverage = {
    withValue: chamadosComCustoExato,
    total: rows.length,
    pct: rows.length > 0 ? Math.round((chamadosComCustoExato / rows.length) * 100) : 0,
  };

  return {
    totalChamados: rows.length,
    totalVendasNoPeriodo: [...vendasPorLoja.values()].reduce((a, b) => a + b, 0),
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
    byStoreVendaVsAssistencia,
    ticketsByTag,
  };
  },
  ["assistencia-kpi-data"],
  { revalidate: 300 }
);

export type AssistenciaMonthlyEvolutionRow = {
  monthKey: string;
  monthLabel: string;
  totalChamados: number;
  totalVendas: number;
  pct: number | null;
};

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Evolução mensal do KPI "Total de chamados de assistência" -- pedido do
// Victor 18/09/2026: tabela com Mês/Ano, Total de Chamados, Total de
// Vendas e % (mesma fórmula/escopo do card principal desta tela, ver
// DELIVERY_REQUEST_TYPES/getVendasCountPorLoja acima -- não conta
// montagem/desmontagem/vistoria/troca de peça, mesmo aviso já no
// subtítulo da página). Independente do período escolhido no RangePicker
// (esse filtra UM período; aqui é sempre os últimos `monthsBack` meses,
// sempre a mesma janela, é uma tendência ao longo do tempo). Só contagem
// (count:exact,head:true) em vez de buscar as linhas inteiras -- muito
// mais barato pra um número por mês, sem precisar de fetchAllPagesParallel.
export const getAssistenciaMonthlyEvolution = unstable_cache(
  async (monthsBack: number = 12): Promise<AssistenciaMonthlyEvolutionRow[]> => {
  const admin = getSupabaseAdmin();
  const now = new Date();
  // Corta meses anteriores ao início do sync de vendas do TOTVS -- senão um
  // mês sem nenhuma venda sincronizada mostraria "0 vendas" (e % infinito/
  // enganoso) só por falta de dado, não porque a loja não vendeu nada.
  // Mesmo cuidado de "dadosIncompletos" em vendas/page.tsx.
  const earliestSyncedDate = await getEarliestSyncedOrderDate();
  const earliestSyncedMonthKey = earliestSyncedDate ? earliestSyncedDate.slice(0, 7) : null;

  const months: { key: string; year: number; month: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (earliestSyncedMonthKey && key < earliestSyncedMonthKey) continue;
    months.push({ key, year: d.getFullYear(), month: d.getMonth() });
  }

  return Promise.all(
    months.map(async ({ key, year, month }) => {
      const fromIso = new Date(Date.UTC(year, month, 1)).toISOString();
      const toIsoExclusive = new Date(Date.UTC(year, month + 1, 1)).toISOString();
      const fromDate = fromIso.slice(0, 10);
      const toDateExclusive = toIsoExclusive.slice(0, 10);

      const [chamadosResult, vendasResult] = await Promise.all([
        admin
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .in("type", DELIVERY_REQUEST_TYPES)
          .not("status", "eq", "cancelada")
          .gte("created_at", fromIso)
          .lt("created_at", toIsoExclusive),
        admin.from("totvs_orders").select("id", { count: "exact", head: true }).eq("type", "Venda").gte("issue_date", fromDate).lt("issue_date", toDateExclusive),
      ]);
      if (chamadosResult.error) throw new Error(chamadosResult.error.message);
      if (vendasResult.error) throw new Error(vendasResult.error.message);

      const totalChamados = chamadosResult.count ?? 0;
      const totalVendas = vendasResult.count ?? 0;
      return {
        monthKey: key,
        monthLabel: `${MONTH_LABELS_PT[month]}/${year}`,
        totalChamados,
        totalVendas,
        pct: totalVendas > 0 ? Math.round((totalChamados / totalVendas) * 1000) / 10 : null,
      };
    })
  );
  },
  ["assistencia-monthly-evolution"],
  { revalidate: 300 }
);
