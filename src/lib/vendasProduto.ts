import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import { sanitizeOrFilterValue } from "./searchFilter";

// Tela "Vendas por produto" (admin + CD, ver 0073_vendas_produto_rls.sql):
// curva semanal de um produto, ranking dos mais vendidos e classificação por
// tipo (colchão, roupeiro...), em cima do histórico de NFs já sincronizado
// do TOTVS (totvs_orders/totvs_order_items, ver 0039_totvs_sync.sql).
// Quantidade é sempre a SOMA líquida (venda + devolução) -- devolução já
// vem com quantidade negativa no payload da TOTVS, então somar direto já dá
// o volume líquido vendido, sem precisar tratar os dois tipos separado.

// Todas as funções recebem um período em datas exatas (não "últimas N
// semanas") -- a tela oferece atalhos (4/8/12/26 semanas) que só calculam
// esse range antes de chamar aqui, mas o range em si é sempre explícito.
export type DateRange = { from: string; to: string };

// Cada semana bucket pela SEGUNDA-feira daquela semana -- rótulo estável,
// não depende de qual dia da semana é "hoje" quando a tela é aberta.
function segundaFeiraDe(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const dow = d.getDay(); // 0=domingo..6=sábado
  const diff = (dow === 0 ? -6 : 1) - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Toda segunda-feira entre o início e o fim do período (inclusive), em
// ordem crescente -- base pra preencher semana sem venda com 0 em vez de
// pular ela silenciosamente.
function segundasNoPeriodo(range: DateRange): string[] {
  const semanas: string[] = [];
  const cursor = new Date(`${segundaFeiraDe(range.from)}T00:00:00`);
  const fim = new Date(`${segundaFeiraDe(range.to)}T00:00:00`);
  while (cursor.getTime() <= fim.getTime()) {
    semanas.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return semanas;
}

// A API do TOTVS não traz categoria/família de produto nenhuma (conferido
// no schema documentado de /rest/orders) -- só código e descrição em texto
// livre. Classificação por palavra-chave na descrição, primeira que bater
// (ordem importa: "COLCHAO" antes de "BOX" evita cruzar "protetor de
// colchão" com box, por ex.). Aproximado por natureza -- fácil de ajustar
// essa lista depois se algum produto cair na categoria errada.
//
// Travesseiro/protetor e cabeceira viraram categorias próprias (separadas
// de colchão e cama/beliche) especificamente pra alimentar o agrupamento
// por família logística abaixo -- itens pequenos/acessórios não podem ficar
// misturados com o item grande que normalmente os acompanha na descrição.
export const PRODUTO_CATEGORIAS = [
  { key: "colchao", label: "Colchão", keywords: ["COLCHAO", "COLCHÃO", "COLCHONETE", "COL "] },
  { key: "travesseiro", label: "Travesseiro / Protetor", keywords: ["TRAVESSEIRO", "TRAV ", "PROTETOR", "PILLOW"] },
  { key: "box_base", label: "Box / Base", keywords: ["BOX", "BASE TOP", "FL BASE", "BAU "] },
  { key: "cama", label: "Cama / Beliche", keywords: ["BELICHE", "CAMA "] },
  { key: "cabeceira", label: "Cabeceira", keywords: ["CABECEIRA"] },
  { key: "roupeiro", label: "Roupeiro / Armário", keywords: ["ROUPEIRO", "ROUP ", "ARMARIO", "ARMÁRIO", "MULTI-USO", "MULTIUSO", "GUARDA-ROUPA", "GUARDA ROUPA"] },
  { key: "comoda", label: "Cômoda", keywords: ["COMODA", "CÔMODA"] },
  { key: "cozinha", label: "Cozinha", keywords: ["COZINHA", "BALCAO", "BALCÃO", "PANELEIRO", "FRUTEIRA"] },
  { key: "sala_jantar", label: "Sala de estar / jantar", keywords: ["SOFA", "SOFÁ", "POLTRONA", "CRISTALEIRA", "BUFFET", "ESTOFADO"] },
  { key: "mesa_cadeira", label: "Mesa / Cadeira", keywords: ["MESA", "CADEIRA", "CONJ."] },
  { key: "estante_home", label: "Estante / Home / Rack", keywords: ["HOME", "RACK", "ESTANTE", "APARADOR"] },
  { key: "puxador", label: "Puxador", keywords: ["PUXADOR"] },
] as const;

export type ProdutoCategoriaKey = (typeof PRODUTO_CATEGORIAS)[number]["key"] | "outros";

export function classificarProduto(description: string | null): { key: ProdutoCategoriaKey; label: string } {
  const upper = (description ?? "").toUpperCase();
  for (const cat of PRODUTO_CATEGORIAS) {
    if (cat.keywords.some((k) => upper.includes(k))) return { key: cat.key, label: cat.label };
  }
  return { key: "outros", label: "Outros" };
}

// Palavra-chave de PEÇA/componente avulso -- não é móvel nenhum, é o nome
// da peça em si. `PRODUTO_CATEGORIAS` acima nunca bate nessas (foi feito
// pra descrição de móvel inteiro, como sempre vem do TOTVS em /vendas) --
// só entram aqui quando `classificarProdutoAssistencia` (abaixo) já
// tentou o móvel inteiro primeiro e não achou.
const PECA_AVULSA_KEYWORDS = ["PORTA", "GAVETA", "ESPELHO", "LATERAL", "PAINEL", "MOLDURA", "PRATELEIRA", "TAMPO", "ENCOSTO", "ASSENTO", "BASE ", "PUXADOR", "KIT "];

// Peça avulsa costuma vir com um código de posição da planta de montagem
// junto -- "N7", "N13" (número da peça no desenho) ou "1UN." (quantidade
// solta, sem nome de móvel do lado) -- reforça a suspeita mesmo quando
// nenhuma palavra da lista acima bate (ex.: "N66 LATERAL PEQ. 1UN." já
// bate por LATERAL, mas um "BASE N2" mais seco também precisa cair aqui).
const PECA_AVULSA_PATTERN = /\bN\d{1,3}\b|^\d+\s?UN\.?\b/;

export type ProdutoAssistenciaKey = ProdutoCategoriaKey | "peca_avulsa";

// Classificação de produto pras telas de assistência (troca/entrega/envio
// de peça) -- pedido do Victor 29/08/2026: "preciso que coloque um botão
// na aba de relatorio... você precisa melhorar essa leitura e
// classificação das notificações de assistencia" (revisão mais ampla,
// não só causa raiz -- ver CAUSA_RAIZ_OPTIONS, assistenciaLabels.ts).
// Achado: em /assistencia, quem digita o produto de um chamado de PEÇA
// geralmente descreve só a peça em si ("PORTA DIREITA N13", "1UN.
// ESPELHO", "BASE N2"), não o móvel inteiro -- diferente de /vendas, onde
// a descrição vem sempre completa e estruturada do TOTVS. Aplicando
// classificarProduto puro nesses casos, tudo cai em "Outros" (confirmado:
// era o maior grupo do gráfico "Chamados por grupo de produto",
// escondendo que boa parte era claramente peça avulsa, só não tinha
// palavra de móvel na descrição). Tenta o móvel inteiro primeiro (mesma
// classificação de /vendas, sem duplicar a lista de palavras-chave) --
// só cai no fallback de peça quando isso não bate em nada.
export function classificarProdutoAssistencia(description: string | null): { key: ProdutoAssistenciaKey; label: string } {
  const base = classificarProduto(description);
  if (base.key !== "outros") return base;
  const upper = (description ?? "").toUpperCase();
  if (PECA_AVULSA_KEYWORDS.some((k) => upper.includes(k)) || PECA_AVULSA_PATTERN.test(upper)) {
    return { key: "peca_avulsa", label: "Peça avulsa / componente" };
  }
  return base;
}

// Agrupamento por volume de transporte (logística), não por nome comercial
// -- pergunta que importa pra quem monta carga é "isso ocupa muito espaço no
// caminhão?", não "isso é sofá ou colchão?". Usado só no gráfico de evolução
// (ver listVendasPorFamiliaLogisticaPorSemana) -- o resto da tela continua
// usando a categoria comercial normal (mais útil pra achar produto).
export const FAMILIA_LOGISTICA_KEYS = ["grande", "medio", "pequeno"] as const;
export type FamiliaLogisticaKey = (typeof FAMILIA_LOGISTICA_KEYS)[number];

export const FAMILIA_LOGISTICA_LABELS: Record<FamiliaLogisticaKey, string> = {
  grande: "Grandes volumes",
  medio: "Volumes médios",
  pequeno: "Pequenos / Acessórios",
};

const FAMILIA_POR_CATEGORIA: Record<ProdutoCategoriaKey, FamiliaLogisticaKey> = {
  roupeiro: "grande",
  sala_jantar: "grande",
  box_base: "grande",
  estante_home: "grande",
  colchao: "medio",
  cama: "medio",
  mesa_cadeira: "medio",
  cozinha: "medio",
  comoda: "medio",
  travesseiro: "pequeno",
  cabeceira: "pequeno",
  puxador: "pequeno",
  outros: "pequeno",
};

export function familiaLogisticaDaCategoria(key: ProdutoCategoriaKey): FamiliaLogisticaKey {
  return FAMILIA_POR_CATEGORIA[key];
}

// Data mais antiga que já existe sincronizada em totvs_orders -- usado pra
// avisar na tela quando o período escolhido (ex.: "26 semanas") vai além do
// que o sync já cobre. Descoberto em 2026-08-13: o sync de pedidos só fez
// backfill de 30 dias quando foi ligado (INITIAL_ORDERS_LOOKBACK_DAYS em
// totvsSync.ts), então qualquer período pedido antes disso mostrava
// silenciosamente "0 vendas" em vez do valor real -- um produto que vendeu
// mais de 500 aparecia como 382, sem nenhum sinal de que faltava dado. O
// backfill histórico foi estendido pra 26 semanas (ver conversa com o
// usuário), mas essa checagem fica de proteção permanente: se o sync algum
// dia atrasar nesse cursor de novo, a tela avisa em vez de mentir um número
// baixo.
export async function getEarliestSyncedOrderDate(): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("totvs_orders").select("issue_date").order("issue_date", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.issue_date ?? null;
}

export type ProdutoSugestao = { productCode: string; description: string | null };

// Busca por código OU descrição -- ilike em substring, mesmo padrão de
// searchTotvsOrdersByInvoice (totvsLookup.ts). Sem índice em `product`/
// `description` (volume ainda pequeno o bastante pra não doer); revisitar
// com um índice trigram se a base de itens crescer muito.
export async function searchProdutosVenda(query: string): Promise<ProdutoSugestao[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  // Sanitiza antes de colar na string do .or() -- achado em revisão de
  // segurança 26/08/2026: `,`/`(`/`)` são delimitadores estruturais desse
  // formato do PostgREST, um valor digitado com esses caracteres quebra o
  // filtro pretendido e permite anexar condições extras (mesmo raciocínio
  // já aplicado em clientes.ts/actions.ts/driver-actions.ts, ver
  // searchFilter.ts).
  const safe = sanitizeOrFilterValue(trimmed);

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("totvs_order_items")
    .select("product, description")
    .not("product", "is", null)
    .or(`product.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(200);

  const seen = new Map<string, ProdutoSugestao>();
  for (const row of data ?? []) {
    if (!row.product || seen.has(row.product)) continue;
    seen.set(row.product, { productCode: row.product, description: row.description });
  }
  return [...seen.values()].slice(0, 15);
}

export type SemanaVenda = { semanaInicio: string; quantidade: number; valor: number };
export type ProdutoVendaCurva = {
  productCode: string;
  description: string | null;
  categoria: { key: ProdutoCategoriaKey; label: string };
  semanas: SemanaVenda[];
  totalPeriodo: number;
  valorPeriodo: number;
  semanaAtual: number;
  semanaAnterior: number;
};

type ItemComData = {
  quantity: number;
  total: number;
  description: string | null;
  totvs_orders: { issue_date: string } | null;
};

// Curva semanal de UM produto -- período de atalho (até 26 semanas) nunca
// chega perto de 5000 linhas pro produto mais vendido (~1073 linhas
// conferido direto no banco), mas o período CUSTOM (campos De/Até da tela)
// não tem esse teto -- alguém pode escolher um intervalo de anos pra um
// produto de saída constante e passar disso numa boa. `.limit(5000)` fixo
// cortava silenciosamente nesse caso (achado 20/08/2026, revisão pedida
// pelo Victor) -- paginado de verdade agora, mesmo padrão de
// fetchItensDoPeriodo mais abaixo.
export async function getVendaCurvaProduto(productCode: string, range: DateRange): Promise<ProdutoVendaCurva | null> {
  const trimmed = productCode.trim();
  if (!trimmed) return null;

  const admin = getSupabaseAdmin();
  const rows = await fetchAllPagesParallel<ItemComData>(
    (from, to) =>
      admin
        .from("totvs_order_items")
        .select("quantity, total, description, totvs_orders!inner(issue_date)", { count: "exact" })
        .eq("product", trimmed)
        .gte("totvs_orders.issue_date", range.from)
        .lte("totvs_orders.issue_date", range.to)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<ItemComData>>,
    { pageSize: RANKING_PAGE_SIZE }
  );

  let description: string | null = null;
  if (rows.length > 0) {
    description = rows[0].description;
  } else {
    // Produto pode existir (catálogo veio de vendas antigas) mas sem
    // movimento no período -- ainda assim mostra a curva zerada em vez de
    // "produto não encontrado", que seria enganoso.
    const { data: anyRow } = await admin.from("totvs_order_items").select("description").eq("product", trimmed).limit(1).maybeSingle();
    if (!anyRow) return null;
    description = anyRow.description;
  }

  return buildCurva(trimmed, description, rows, range);
}

function buildCurva(productCode: string, description: string | null, rows: ItemComData[], range: DateRange): ProdutoVendaCurva {
  const porSemana = new Map<string, { quantidade: number; valor: number }>();
  for (const row of rows) {
    if (!row.totvs_orders) continue;
    const semana = segundaFeiraDe(row.totvs_orders.issue_date);
    const acc = porSemana.get(semana) ?? { quantidade: 0, valor: 0 };
    acc.quantidade += row.quantity;
    acc.valor += row.total;
    porSemana.set(semana, acc);
  }

  // Preenche TODAS as semanas do período, mesmo as sem venda nenhuma (fica
  // 0) -- senão o gráfico "pula" semanas silenciosamente e passa a
  // impressão errada de que a semana nem existiu.
  const semanas: SemanaVenda[] = segundasNoPeriodo(range).map((semanaIso) => {
    const acc = porSemana.get(semanaIso) ?? { quantidade: 0, valor: 0 };
    return { semanaInicio: semanaIso, quantidade: acc.quantidade, valor: acc.valor };
  });

  const totalPeriodo = semanas.reduce((s, w) => s + w.quantidade, 0);
  const valorPeriodo = semanas.reduce((s, w) => s + w.valor, 0);
  const semanaAtual = semanas[semanas.length - 1]?.quantidade ?? 0;
  const semanaAnterior = semanas[semanas.length - 2]?.quantidade ?? 0;

  return {
    productCode,
    description,
    categoria: classificarProduto(description),
    semanas,
    totalPeriodo,
    valorPeriodo,
    semanaAtual,
    semanaAnterior,
  };
}

export type ProdutoRankingItem = {
  productCode: string;
  description: string | null;
  categoria: { key: ProdutoCategoriaKey; label: string };
  quantidade: number;
  valor: number;
};

type ItemRankingRow = {
  product: string | null;
  description: string | null;
  quantity: number;
  total: number;
  totvs_orders: { issue_date: string } | null;
};

// Todo o histórico do período cabe em memória pra agregar (ranking geral,
// por categoria E por categoria-por-semana) -- paginado de verdade (não
// confia no default de 1000 linhas do PostgREST): num período de várias
// semanas, o total de itens pode passar disso fácil. Páginas buscadas em
// PARALELO (ver fetchAllPagesParallel) -- achado 19/08/2026: essa função
// sozinha, sequencial e com um teto de 30 páginas (30.000 linhas), já
// truncava silenciosamente o período padrão de 12 semanas (34.206 linhas
// reais) E ainda levava a maior parte dos 20s que a tela de Vendas chegou a
// demorar pra carregar. Sem teto de páginas agora -- o count exato já
// resolve quantas existem de verdade, não precisa mais de um limite
// arbitrário "por segurança".
const RANKING_PAGE_SIZE = 1000;

async function fetchItensDoPeriodo(range: DateRange): Promise<ItemRankingRow[]> {
  const admin = getSupabaseAdmin();

  return fetchAllPagesParallel<ItemRankingRow>(
    (from, to) =>
      admin
        .from("totvs_order_items")
        .select("product, description, quantity, total, totvs_orders!inner(issue_date)", { count: "exact" })
        .gte("totvs_orders.issue_date", range.from)
        .lte("totvs_orders.issue_date", range.to)
        .not("product", "is", null)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<ItemRankingRow>>,
    { pageSize: RANKING_PAGE_SIZE }
  );
}

// categoria opcional -- quando informada, filtra o ranking só pra produtos
// classificados nela (ver classificarProduto). Extraída de listRankingProdutos
// pra poder rodar em cima de um `rows` já buscado (ver getVendasPeriodoResumo)
// em vez de buscar de novo -- mesmo dado, sem ida ao banco repetida.
function aggregateRankingProdutos(rows: ItemRankingRow[], limit: number, categoria?: ProdutoCategoriaKey): ProdutoRankingItem[] {
  const porProduto = new Map<string, ProdutoRankingItem>();
  for (const row of rows) {
    if (!row.product) continue;
    const cat = classificarProduto(row.description);
    if (categoria && cat.key !== categoria) continue;
    const acc = porProduto.get(row.product) ?? { productCode: row.product, description: row.description, categoria: cat, quantidade: 0, valor: 0 };
    acc.quantidade += row.quantity;
    acc.valor += row.total;
    if (!acc.description && row.description) acc.description = row.description;
    porProduto.set(row.product, acc);
  }

  return [...porProduto.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, limit);
}

export async function listRankingProdutos(range: DateRange, limit: number, categoria?: ProdutoCategoriaKey): Promise<ProdutoRankingItem[]> {
  const rows = await fetchItensDoPeriodo(range);
  return aggregateRankingProdutos(rows, limit, categoria);
}

export type ProdutoSaldoEstoque = {
  // "o que tem em estoque" -- saldo físico no CD (current_balance),
  // independente de já estar comprometido com venda ou não.
  saldoAtual: number;
  // "número de vendas já feitas daquele produto" (reserved_qty, WSStock)
  // -- pedido do Victor 28/08/2026, corrigindo o entendimento anterior
  // (esse campo existia sincronizado desde sempre em totvs_stock, mas
  // nunca tinha sido lido daqui). Pode passar do saldoAtual (produto
  // vendido além do que tem fisicamente no CD, aguardando reposição) --
  // de propósito não fica negativo aqui, só saldoDisponivel reflete isso.
  saldoReservado: number;
  // "o que tem disponível" pra vender de novo = saldoAtual - saldoReservado
  // -- pedido do Victor 28/08/2026: "entenda que: qtd. disponivel é o que
  // tem disponivel, qtd. atual é o que tem em estoque e qtd. de reserva é
  // o numero de vendas ja feitas". Sem clamp em 0 de propósito: negativo
  // significa produto vendido além do saldo físico (oversold) -- sinal
  // real pro comprador, não bug (708 dos 3635 produtos do catálogo estão
  // nesse estado hoje).
  saldoDisponivel: number;
  // null = sem venda nos últimos RUNWAY_DIAS_JANELA_VENDA dias -- não dá
  // pra calcular "dias restantes" que faça sentido (mesmo com saldo baixo,
  // sem saída não é ruptura iminente), a UI trata isso não mostrando alerta.
  // Baseado em saldoDisponivel (não saldoAtual) -- unidade já reservada
  // não conta como cobertura de venda futura.
  diasDeCobertura: number | null;
  // Saldo em pedido de compra aberto (fábrica → CD) + previsão de chegada
  // -- pedido do Victor 27/08/2026: "eu consigo puxar do protheus a
  // previsao de chegada dos produtos?" (produto padrão de catálogo, não
  // encomenda -- essa já tem prazo próprio, ver pedidosEncomenda.ts). O
  // Protheus já manda os dois campos no mesmo WSStock que dá saldoAtual
  // (ver syncStock, totvsSync.ts) -- só não estavam sendo lidos daqui.
  // null = sem pedido de compra em aberto pra esse produto agora.
  saldoEmPedidoCompra: number | null;
  previsaoChegada: string | null;
};

const RUNWAY_DIAS_JANELA_VENDA = 30;
export const RUNWAY_DIAS_ALERTA = 7;

// Saldo atual no CD (totvs_stock, sincronizado do WSStock -- ver
// syncStock em totvsSync.ts, roda fora do request, então esse saldo tem o
// atraso do último sync, não é em tempo real) + dias de cobertura (saldo /
// média de saída diária nos últimos 30 dias, sempre relativo a hoje, igual
// listTendenciaProdutos).
export async function listSaldoEstoqueProdutos(productCodes: string[]): Promise<Map<string, ProdutoSaldoEstoque>> {
  const resultado = new Map<string, ProdutoSaldoEstoque>();
  if (productCodes.length === 0) return resultado;

  const admin = getSupabaseAdmin();

  // `totvs_stock` é tabela nova (0074_totvs_stock.sql) alimentada por um
  // sync que roda fora do request (ver syncStock em totvsSync.ts) -- se a
  // migration ainda não rodou nesse ambiente, ou o sync ainda não populou
  // nada, o resto da tela (ranking, curva, tendência) não pode cair junto
  // só por causa disso. Loga e devolve vazio em vez de derrubar a página.
  try {
    const [{ data: stockRows, error: stockError }, vendaPorProduto] = await Promise.all([
      admin
        .from("totvs_stock")
        .select("product_code, current_balance, reserved_qty, purchase_order_balance, estimated_arrival_date")
        .in("product_code", productCodes),
      (async () => {
        const inicio = isoDateSub(RUNWAY_DIAS_JANELA_VENDA);
        const fim = isoDateSub(0);
        const acc = new Map<string, number>();
        const rows = await fetchAllPagesParallel<{ product: string | null; quantity: number }>(
          (from, to) =>
            admin
              .from("totvs_order_items")
              .select("product, quantity, totvs_orders!inner(issue_date)", { count: "exact" })
              .in("product", productCodes)
              .gte("totvs_orders.issue_date", inicio)
              .lte("totvs_orders.issue_date", fim)
              .range(from, to) as unknown as PromiseLike<PagedQueryResult<{ product: string | null; quantity: number }>>,
          { pageSize: RANKING_PAGE_SIZE }
        );
        for (const row of rows) {
          if (!row.product) continue;
          acc.set(row.product, (acc.get(row.product) ?? 0) + row.quantity);
        }
        return acc;
      })(),
    ]);
    if (stockError) throw new Error(stockError.message);

    const stockPorProduto = new Map<
      string,
      { saldoAtual: number; saldoReservado: number; saldoEmPedidoCompra: number | null; previsaoChegada: string | null }
    >();
    for (const row of stockRows ?? []) {
      stockPorProduto.set(row.product_code, {
        saldoAtual: Number(row.current_balance) || 0,
        saldoReservado: Number(row.reserved_qty) || 0,
        saldoEmPedidoCompra: row.purchase_order_balance != null ? Number(row.purchase_order_balance) : null,
        previsaoChegada: row.estimated_arrival_date,
      });
    }

    for (const code of productCodes) {
      const stock = stockPorProduto.get(code);
      const saldoAtual = stock?.saldoAtual ?? 0;
      const saldoReservado = stock?.saldoReservado ?? 0;
      const saldoDisponivel = saldoAtual - saldoReservado;
      const totalVendido = vendaPorProduto.get(code) ?? 0;
      const mediaDiaria = totalVendido / RUNWAY_DIAS_JANELA_VENDA;
      const diasDeCobertura = mediaDiaria > 0 ? saldoDisponivel / mediaDiaria : null;
      resultado.set(code, {
        saldoAtual,
        saldoReservado,
        saldoDisponivel,
        diasDeCobertura,
        saldoEmPedidoCompra: stock?.saldoEmPedidoCompra ?? null,
        previsaoChegada: stock?.previsaoChegada ?? null,
      });
    }
  } catch (err) {
    console.error("listSaldoEstoqueProdutos:", (err as Error).message);
  }
  return resultado;
}

export type ProdutoPrazo = {
  productCode: string;
  description: string | null;
  saldoAtual: number;
  // Ver ProdutoSaldoEstoque (mesmos campos/definições, reaproveitados
  // aqui pra tela "Prazos de produtos" -- pedido do Victor 28/08/2026).
  saldoReservado: number;
  saldoDisponivel: number;
  saldoEmPedidoCompra: number | null;
  previsaoChegada: string | null;
  diasDeCobertura: number | null;
};

// Busca por código OU descrição direto em totvs_stock (catálogo inteiro,
// ~3600 produtos) -- diferente de searchProdutosVenda (totvs_order_items,
// só produto que já vendeu). "Prazos de produtos" precisa achar qualquer
// item com estoque/pedido de compra, tenha vendido ou não. Mesmo padrão
// de sanitização/limite de searchProdutosVenda (searchFilter.ts).
export async function searchProdutosEstoque(query: string): Promise<ProdutoSugestao[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const safe = sanitizeOrFilterValue(trimmed);

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("totvs_stock")
    .select("product_code, description")
    .or(`product_code.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(15);

  return (data ?? []).map((r) => ({ productCode: r.product_code, description: r.description }));
}

// Nome do produto a partir do código -- pedido do Victor 28/08/2026: "no
// cadastro do estoque, puxe o nome do produto pelo código do produto"
// (formulário "Nova movimentação de estoque", ver
// NewStockMovementForm.tsx). `ilike` sem `%` faz busca exata só que
// insensível a maiúsculas/minúsculas -- código digitado em caixa
// diferente da cadastrada no Protheus (aconteceu de verdade na
// importação histórica, ex. "l001918") ainda acha o produto.
export async function getProdutoNomePorCodigo(code: string): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("totvs_stock").select("description").ilike("product_code", trimmed).maybeSingle();
  return data?.description ?? null;
}

// Um produto só, por código exato -- resolve o card de detalhe da tela
// "Prazos de produtos" quando a busca (searchProdutosEstoque) resolve pra
// 1 resultado só. Mesma leitura de totvs_stock de
// listProdutosComPedidoDeCompra, mas pra 1 código, incluindo produto sem
// pedido de compra aberto (previsaoChegada/saldoEmPedidoCompra null).
export async function getProdutoPrazo(productCode: string): Promise<ProdutoPrazo | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("totvs_stock")
    .select("product_code, description, current_balance, purchase_order_balance, estimated_arrival_date")
    .eq("product_code", productCode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const saldo = (await listSaldoEstoqueProdutos([productCode])).get(productCode);
  const saldoAtual = Number(data.current_balance) || 0;
  return {
    productCode: data.product_code,
    description: data.description,
    saldoAtual,
    saldoReservado: saldo?.saldoReservado ?? 0,
    saldoDisponivel: saldo?.saldoDisponivel ?? saldoAtual,
    saldoEmPedidoCompra: data.purchase_order_balance != null ? Number(data.purchase_order_balance) : null,
    previsaoChegada: data.estimated_arrival_date,
    diasDeCobertura: saldo?.diasDeCobertura ?? null,
  };
}

// Tela "Prazos de produtos" (admin/assistência/SAC, ver
// src/app/assistencia/(app)/prazos-produtos/page.tsx) -- pedido do Victor
// 27/08/2026: "preciso de uma nova aba... coloque tudo lá" (movido de
// dentro do card de curva em /vendas, que só quem tem a senha do painel
// de KPIs conseguia ver). Todo produto com pedido de compra aberto
// (fábrica → CD), ordenado pela previsão de chegada mais próxima primeiro
// -- direto de totvs_stock (176 produtos hoje), sem precisar do join com
// totvs_order_items que a curva de vendas usa. diasDeCobertura reaproveita
// listSaldoEstoqueProdutos (mesma conta de sempre) pra poder destacar
// ruptura na lista.
export async function listProdutosComPedidoDeCompra(): Promise<ProdutoPrazo[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("totvs_stock")
    .select("product_code, description, current_balance, purchase_order_balance, estimated_arrival_date")
    .gt("purchase_order_balance", 0)
    .order("estimated_arrival_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const codes = rows.map((r) => r.product_code);
  const saldoPorProduto = await listSaldoEstoqueProdutos(codes);

  return rows.map((r) => {
    const saldoAtual = Number(r.current_balance) || 0;
    const saldo = saldoPorProduto.get(r.product_code);
    return {
      productCode: r.product_code,
      description: r.description,
      saldoAtual,
      saldoReservado: saldo?.saldoReservado ?? 0,
      saldoDisponivel: saldo?.saldoDisponivel ?? saldoAtual,
      saldoEmPedidoCompra: r.purchase_order_balance != null ? Number(r.purchase_order_balance) : null,
      previsaoChegada: r.estimated_arrival_date,
      diasDeCobertura: saldo?.diasDeCobertura ?? null,
    };
  });
}

export type ProdutoTendencia = { variacaoPct: number | null };

const TENDENCIA_SEMANAS = 4;

function isoDateSub(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Tendência por produto -- últimas 4 semanas vs. as 4 anteriores a essas,
// sempre relativo a HOJE (não ao período que o comprador escolheu filtrar
// no ranking) -- dá um sinal estável de "subindo/esfriando" que não muda
// só porque o filtro de período da tela mudou. `previas === 0` não vira
// "infinito", vira `null` (sem base de comparação -- produto novo ou sem
// venda nenhuma nas 4 semanas anteriores), a UI trata isso escondendo o
// indicador em vez de mostrar um percentual sem sentido.
export async function listTendenciaProdutos(productCodes: string[]): Promise<Map<string, ProdutoTendencia>> {
  const resultado = new Map<string, ProdutoTendencia>();
  if (productCodes.length === 0) return resultado;

  const fim = isoDateSub(0);
  const inicioUltimas = isoDateSub(TENDENCIA_SEMANAS * 7);
  const inicioPrevias = isoDateSub(TENDENCIA_SEMANAS * 2 * 7);

  const admin = getSupabaseAdmin();
  const ultimasPorProduto = new Map<string, number>();
  const previasPorProduto = new Map<string, number>();

  type TendenciaRow = { product: string | null; quantity: number; totvs_orders: { issue_date: string } | null };
  const rows = await fetchAllPagesParallel<TendenciaRow>(
    (from, to) =>
      admin
        .from("totvs_order_items")
        .select("product, quantity, totvs_orders!inner(issue_date)", { count: "exact" })
        .in("product", productCodes)
        .gte("totvs_orders.issue_date", inicioPrevias)
        .lte("totvs_orders.issue_date", fim)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<TendenciaRow>>,
    { pageSize: RANKING_PAGE_SIZE }
  );
  for (const row of rows) {
    if (!row.product || !row.totvs_orders) continue;
    const bucket = row.totvs_orders.issue_date >= inicioUltimas ? ultimasPorProduto : previasPorProduto;
    bucket.set(row.product, (bucket.get(row.product) ?? 0) + row.quantity);
  }

  for (const code of productCodes) {
    const ultimas = ultimasPorProduto.get(code) ?? 0;
    const previas = previasPorProduto.get(code) ?? 0;
    const variacaoPct = previas > 0 ? Math.round(((ultimas - previas) / previas) * 100) : null;
    resultado.set(code, { variacaoPct });
  }
  return resultado;
}

export type CategoriaResumo = { key: ProdutoCategoriaKey; label: string; quantidade: number; valor: number };

// Visão "por tipo de produto" -- resposta direta ao que a tela não tinha
// antes (só listava produto por produto, sem dar pra comparar categoria
// contra categoria de cara). Uma foto do período inteiro (sem quebra por
// semana) -- ver listVendasPorCategoriaPorSemana pra evolução no tempo.
function aggregateVendasPorCategoria(rows: ItemRankingRow[]): CategoriaResumo[] {
  const porCategoria = new Map<ProdutoCategoriaKey, CategoriaResumo>();
  for (const row of rows) {
    const cat = classificarProduto(row.description);
    const acc = porCategoria.get(cat.key) ?? { key: cat.key, label: cat.label, quantidade: 0, valor: 0 };
    acc.quantidade += row.quantity;
    acc.valor += row.total;
    porCategoria.set(cat.key, acc);
  }

  return [...porCategoria.values()].sort((a, b) => b.quantidade - a.quantidade);
}

export async function listVendasPorCategoria(range: DateRange): Promise<CategoriaResumo[]> {
  const rows = await fetchItensDoPeriodo(range);
  return aggregateVendasPorCategoria(rows);
}

// { semanaInicio: "2026-07-06", colchao: 12, roupeiro: 4, ... } -- uma linha
// por semana, uma chave por categoria -- formato que o recharts espera pra
// desenhar uma <Line> por categoria (ver CategoriaEvolucaoChart.tsx). Só
// entram categorias com pelo menos 1 venda em ALGUMA semana do período, pra
// não desenhar série vazia.
export type CategoriaEvolucaoSemana = { semanaInicio: string } & Record<string, number | string>;

export async function listVendasPorCategoriaPorSemana(
  range: DateRange
): Promise<{ semanas: CategoriaEvolucaoSemana[]; categorias: { key: ProdutoCategoriaKey; label: string }[] }> {
  const rows = await fetchItensDoPeriodo(range);

  const porSemanaCategoria = new Map<string, Map<ProdutoCategoriaKey, number>>();
  const categoriasVistas = new Map<ProdutoCategoriaKey, string>();
  for (const row of rows) {
    if (!row.totvs_orders) continue;
    const semana = segundaFeiraDe(row.totvs_orders.issue_date);
    const cat = classificarProduto(row.description);
    categoriasVistas.set(cat.key, cat.label);
    const porCategoria = porSemanaCategoria.get(semana) ?? new Map<ProdutoCategoriaKey, number>();
    porCategoria.set(cat.key, (porCategoria.get(cat.key) ?? 0) + row.quantity);
    porSemanaCategoria.set(semana, porCategoria);
  }

  // Ordena categorias pelo volume total (maior primeiro) -- na barra
  // empilhada isso deixa a categoria mais vendida na base, mais fácil de
  // comparar visualmente.
  const totalPorCategoria = new Map<ProdutoCategoriaKey, number>();
  for (const porCategoria of porSemanaCategoria.values()) {
    for (const [key, qtd] of porCategoria) {
      totalPorCategoria.set(key, (totalPorCategoria.get(key) ?? 0) + qtd);
    }
  }
  const categorias = [...categoriasVistas.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => (totalPorCategoria.get(b.key) ?? 0) - (totalPorCategoria.get(a.key) ?? 0));

  const semanas: CategoriaEvolucaoSemana[] = segundasNoPeriodo(range).map((semanaIso) => {
    const porCategoria = porSemanaCategoria.get(semanaIso);
    const linha: CategoriaEvolucaoSemana = { semanaInicio: semanaIso };
    for (const cat of categorias) {
      linha[cat.key] = porCategoria?.get(cat.key) ?? 0;
    }
    return linha;
  });

  return { semanas, categorias };
}

// Mesmo formato/uso de listVendasPorCategoriaPorSemana acima, só que
// agrupado pelas 3 famílias logísticas (ver familiaLogisticaDaCategoria) em
// vez das categorias comerciais -- pergunta de quem monta carga, não de
// quem procura produto. Sempre retorna as 3 famílias (mesmo com 0 no
// período), ao contrário da versão por categoria, que só inclui categoria
// com venda -- com só 3 séries fixas, mostrar a família zerada é mais fácil
// de comparar do que ela sumir do gráfico.
function aggregateVendasPorFamiliaLogisticaPorSemana(
  rows: ItemRankingRow[],
  range: DateRange
): { semanas: CategoriaEvolucaoSemana[]; familias: { key: FamiliaLogisticaKey; label: string }[] } {
  const porSemanaFamilia = new Map<string, Map<FamiliaLogisticaKey, number>>();
  for (const row of rows) {
    if (!row.totvs_orders) continue;
    const semana = segundaFeiraDe(row.totvs_orders.issue_date);
    const cat = classificarProduto(row.description);
    const familia = familiaLogisticaDaCategoria(cat.key);
    const porFamilia = porSemanaFamilia.get(semana) ?? new Map<FamiliaLogisticaKey, number>();
    porFamilia.set(familia, (porFamilia.get(familia) ?? 0) + row.quantity);
    porSemanaFamilia.set(semana, porFamilia);
  }

  const familias = FAMILIA_LOGISTICA_KEYS.map((key) => ({ key, label: FAMILIA_LOGISTICA_LABELS[key] }));

  const semanas: CategoriaEvolucaoSemana[] = segundasNoPeriodo(range).map((semanaIso) => {
    const porFamilia = porSemanaFamilia.get(semanaIso);
    const linha: CategoriaEvolucaoSemana = { semanaInicio: semanaIso };
    for (const familia of familias) {
      linha[familia.key] = porFamilia?.get(familia.key) ?? 0;
    }
    return linha;
  });

  return { semanas, familias };
}

export async function listVendasPorFamiliaLogisticaPorSemana(
  range: DateRange
): Promise<{ semanas: CategoriaEvolucaoSemana[]; familias: { key: FamiliaLogisticaKey; label: string }[] }> {
  const rows = await fetchItensDoPeriodo(range);
  return aggregateVendasPorFamiliaLogisticaPorSemana(rows, range);
}

export type VendasPeriodoResumo = {
  ranking: ProdutoRankingItem[];
  categorias: CategoriaResumo[];
  evolucaoFamilia: { semanas: CategoriaEvolucaoSemana[]; familias: { key: FamiliaLogisticaKey; label: string }[] };
};

// Ranking, resumo por categoria e evolução por família logística dependiam
// TODOS do mesmo `fetchItensDoPeriodo(range)` -- até aqui, cada função
// buscava esse conjunto de novo (idas ao banco pro MESMO dado, em paralelo
// mas ainda assim trabalho repetido), o maior gargalo de carregamento da
// tela "Vendas por produto" (identificado 2026-08-13). Busca uma vez só e
// agrega os 3 jeitos em memória.
export async function getVendasPeriodoResumo(
  range: DateRange,
  rankingLimit: number,
  categoriaFiltro?: ProdutoCategoriaKey
): Promise<VendasPeriodoResumo> {
  const rows = await fetchItensDoPeriodo(range);

  return {
    ranking: aggregateRankingProdutos(rows, rankingLimit, categoriaFiltro),
    categorias: aggregateVendasPorCategoria(rows),
    evolucaoFamilia: aggregateVendasPorFamiliaLogisticaPorSemana(rows, range),
  };
}
