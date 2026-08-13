import { getSupabaseAdmin } from "./supabaseAdmin";

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

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("totvs_order_items")
    .select("product, description")
    .not("product", "is", null)
    .or(`product.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
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

// Curva semanal de UM produto -- todas as linhas do período cabem numa
// página só (um produto específico, período limitado, não precisa paginar).
export async function getVendaCurvaProduto(productCode: string, range: DateRange): Promise<ProdutoVendaCurva | null> {
  const trimmed = productCode.trim();
  if (!trimmed) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("totvs_order_items")
    .select("quantity, total, description, totvs_orders!inner(issue_date)")
    .eq("product", trimmed)
    .gte("totvs_orders.issue_date", range.from)
    .lte("totvs_orders.issue_date", range.to)
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ItemComData[];
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
// semanas, o total de itens pode passar disso fácil. Corta em MAX_PAGINAS
// por segurança (nunca deve bater nisso com o volume atual, mas evita loop
// sem fim se um dia bater).
const RANKING_PAGE_SIZE = 1000;
const RANKING_MAX_PAGINAS = 30;

async function fetchItensDoPeriodo(range: DateRange): Promise<ItemRankingRow[]> {
  const admin = getSupabaseAdmin();

  const rows: ItemRankingRow[] = [];
  for (let pagina = 0; pagina < RANKING_MAX_PAGINAS; pagina++) {
    const from = pagina * RANKING_PAGE_SIZE;
    const { data, error } = await admin
      .from("totvs_order_items")
      .select("product, description, quantity, total, totvs_orders!inner(issue_date)")
      .gte("totvs_orders.issue_date", range.from)
      .lte("totvs_orders.issue_date", range.to)
      .not("product", "is", null)
      .range(from, from + RANKING_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as ItemRankingRow[];
    rows.push(...batch);
    if (batch.length < RANKING_PAGE_SIZE) break;
  }
  return rows;
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
  saldoAtual: number;
  // null = sem venda nos últimos RUNWAY_DIAS_JANELA_VENDA dias -- não dá
  // pra calcular "dias restantes" que faça sentido (mesmo com saldo baixo,
  // sem saída não é ruptura iminente), a UI trata isso não mostrando alerta.
  diasDeCobertura: number | null;
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
      admin.from("totvs_stock").select("product_code, current_balance").in("product_code", productCodes),
      (async () => {
        const inicio = isoDateSub(RUNWAY_DIAS_JANELA_VENDA);
        const fim = isoDateSub(0);
        const acc = new Map<string, number>();
        for (let pagina = 0; pagina < RANKING_MAX_PAGINAS; pagina++) {
          const from = pagina * RANKING_PAGE_SIZE;
          const { data, error } = await admin
            .from("totvs_order_items")
            .select("product, quantity, totvs_orders!inner(issue_date)")
            .in("product", productCodes)
            .gte("totvs_orders.issue_date", inicio)
            .lte("totvs_orders.issue_date", fim)
            .range(from, from + RANKING_PAGE_SIZE - 1);
          if (error) throw new Error(error.message);
          const batch = (data ?? []) as unknown as { product: string | null; quantity: number }[];
          for (const row of batch) {
            if (!row.product) continue;
            acc.set(row.product, (acc.get(row.product) ?? 0) + row.quantity);
          }
          if (batch.length < RANKING_PAGE_SIZE) break;
        }
        return acc;
      })(),
    ]);
    if (stockError) throw new Error(stockError.message);

    const saldoPorProduto = new Map<string, number>();
    for (const row of stockRows ?? []) {
      saldoPorProduto.set(row.product_code, Number(row.current_balance) || 0);
    }

    for (const code of productCodes) {
      const saldoAtual = saldoPorProduto.get(code) ?? 0;
      const totalVendido = vendaPorProduto.get(code) ?? 0;
      const mediaDiaria = totalVendido / RUNWAY_DIAS_JANELA_VENDA;
      const diasDeCobertura = mediaDiaria > 0 ? saldoAtual / mediaDiaria : null;
      resultado.set(code, { saldoAtual, diasDeCobertura });
    }
  } catch (err) {
    console.error("listSaldoEstoqueProdutos:", (err as Error).message);
  }
  return resultado;
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

  for (let pagina = 0; pagina < RANKING_MAX_PAGINAS; pagina++) {
    const from = pagina * RANKING_PAGE_SIZE;
    const { data, error } = await admin
      .from("totvs_order_items")
      .select("product, quantity, totvs_orders!inner(issue_date)")
      .in("product", productCodes)
      .gte("totvs_orders.issue_date", inicioPrevias)
      .lte("totvs_orders.issue_date", fim)
      .range(from, from + RANKING_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as { product: string | null; quantity: number; totvs_orders: { issue_date: string } | null }[];
    for (const row of batch) {
      if (!row.product || !row.totvs_orders) continue;
      const bucket = row.totvs_orders.issue_date >= inicioUltimas ? ultimasPorProduto : previasPorProduto;
      bucket.set(row.product, (bucket.get(row.product) ?? 0) + row.quantity);
    }
    if (batch.length < RANKING_PAGE_SIZE) break;
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
// desenhar barras empilhadas com uma <Bar> por categoria (ver
// CategoriaEvolucaoChart.tsx). Só entram categorias com pelo menos 1 venda
// em ALGUMA semana do período, pra não empilhar série vazia.
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

export type VendidoDespachadoSemana = { semanaInicio: string; vendido: number; despachado: number };

const DESPACHO_PAGE_SIZE = 1000;
const DESPACHO_MAX_PAGINAS = 30;

// "Despachado" = cargas com status_entrega "Entregue" (entrega concluída) --
// o sync do Protheus não guarda nenhum evento de "saiu do CD", "Entregue" é
// o sinal mais próximo disponível (decisão confirmada com o usuário
// 12/08/2026). "Entregue Parcial" fica de fora de propósito: não temos a
// quantidade real entregue nessa carga, só do pedido inteiro -- contar como
// se fosse total superestimaria o despacho.
async function buildDespachoPorSemana(range: DateRange): Promise<Map<string, number>> {
  const admin = getSupabaseAdmin();
  const resultado = new Map<string, number>();

  const cargas: { notaFiscal: string; serie: string; semana: string }[] = [];
  for (let pagina = 0; pagina < DESPACHO_MAX_PAGINAS; pagina++) {
    const from = pagina * DESPACHO_PAGE_SIZE;
    const { data, error } = await admin
      .from("totvs_delivery_cargas")
      .select("nota_fiscal, serie, dt_retorno")
      .eq("status_entrega", "Entregue")
      .not("nota_fiscal", "is", null)
      .not("serie", "is", null)
      .gte("dt_retorno", range.from)
      .lte("dt_retorno", range.to)
      .range(from, from + DESPACHO_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      if (!row.nota_fiscal || !row.serie || !row.dt_retorno) continue;
      cargas.push({ notaFiscal: row.nota_fiscal, serie: row.serie, semana: segundaFeiraDe(row.dt_retorno) });
    }
    if (batch.length < DESPACHO_PAGE_SIZE) break;
  }
  if (cargas.length === 0) return resultado;

  // Sem FK física entre totvs_delivery_cargas e totvs_orders (syncs
  // independentes, mesmo motivo de sempre) -- join em código, mesmo padrão
  // já usado no resto do arquivo.
  const notasFiscais = [...new Set(cargas.map((c) => c.notaFiscal))];
  const { data: ordersData, error: ordersError } = await admin
    .from("totvs_orders")
    .select("id, invoice, serie")
    .in("invoice", notasFiscais);
  if (ordersError) throw new Error(ordersError.message);

  const orderIdPorNotaSerie = new Map<string, string>();
  for (const o of ordersData ?? []) {
    orderIdPorNotaSerie.set(`${o.invoice}|${o.serie}`, o.id);
  }

  // Dedup por pedido -- um pedido pode ter mais de uma carga (múltiplas
  // tentativas de entrega), mas a quantidade dele só pode contar UMA vez;
  // fica na semana da entrega concluída mais recente.
  const semanaPorOrderId = new Map<string, string>();
  for (const carga of cargas) {
    const orderId = orderIdPorNotaSerie.get(`${carga.notaFiscal}|${carga.serie}`);
    if (!orderId) continue;
    const atual = semanaPorOrderId.get(orderId);
    if (!atual || carga.semana > atual) semanaPorOrderId.set(orderId, carga.semana);
  }
  const orderIds = [...semanaPorOrderId.keys()];
  if (orderIds.length === 0) return resultado;

  const qtdPorOrderId = new Map<string, number>();
  for (let pagina = 0; pagina < DESPACHO_MAX_PAGINAS; pagina++) {
    const from = pagina * DESPACHO_PAGE_SIZE;
    const { data, error } = await admin
      .from("totvs_order_items")
      .select("order_id, quantity")
      .in("order_id", orderIds)
      .range(from, from + DESPACHO_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      qtdPorOrderId.set(row.order_id, (qtdPorOrderId.get(row.order_id) ?? 0) + row.quantity);
    }
    if (batch.length < DESPACHO_PAGE_SIZE) break;
  }

  for (const [orderId, semana] of semanaPorOrderId) {
    const qtd = qtdPorOrderId.get(orderId) ?? 0;
    resultado.set(semana, (resultado.get(semana) ?? 0) + qtd);
  }
  return resultado;
}

function aggregateVendidoPorSemana(rows: ItemRankingRow[]): Map<string, number> {
  const vendidoPorSemana = new Map<string, number>();
  for (const row of rows) {
    if (!row.totvs_orders) continue;
    const semana = segundaFeiraDe(row.totvs_orders.issue_date);
    vendidoPorSemana.set(semana, (vendidoPorSemana.get(semana) ?? 0) + row.quantity);
  }
  return vendidoPorSemana;
}

// Vendido (totvs_order_items pela data de emissão) vs. Despachado (ver
// buildDespachoPorSemana) por semana -- a diferença entre as duas barras é
// o backlog que a logística ainda precisa carregar/entregar. Falha
// isolada (mesmo espírito de listSaldoEstoqueProdutos): se o cruzamento de
// despacho der erro, o gráfico ainda mostra o "vendido" sozinho em vez de
// derrubar a tela inteira.
export async function listVendidoVsDespachadoPorSemana(range: DateRange): Promise<VendidoDespachadoSemana[]> {
  const itensVendidos = await fetchItensDoPeriodo(range);
  const vendidoPorSemana = aggregateVendidoPorSemana(itensVendidos);

  let despachoPorSemana = new Map<string, number>();
  try {
    despachoPorSemana = await buildDespachoPorSemana(range);
  } catch (err) {
    console.error("listVendidoVsDespachadoPorSemana (despacho):", (err as Error).message);
  }

  return segundasNoPeriodo(range).map((semanaIso) => ({
    semanaInicio: semanaIso,
    vendido: vendidoPorSemana.get(semanaIso) ?? 0,
    despachado: despachoPorSemana.get(semanaIso) ?? 0,
  }));
}

export type VendasPeriodoResumo = {
  ranking: ProdutoRankingItem[];
  categorias: CategoriaResumo[];
  evolucaoFamilia: { semanas: CategoriaEvolucaoSemana[]; familias: { key: FamiliaLogisticaKey; label: string }[] };
  vendidoDespachado: VendidoDespachadoSemana[];
};

// Ranking, resumo por categoria, evolução por família logística e vendido-x-
// despachado dependiam TODOS do mesmo `fetchItensDoPeriodo(range)` -- até
// aqui, cada função buscava esse conjunto de novo (4 idas ao banco pro MESMO
// dado, em paralelo mas ainda assim 4x o trabalho), o maior gargalo de
// carregamento da tela "Vendas por produto" (identificado 2026-08-13). Busca
// uma vez só e agrega os 4 jeitos em memória; o fetch de despacho continua
// separado (tabela diferente, totvs_delivery_cargas, não depende dos itens)
// e roda em paralelo com o fetch dos itens.
export async function getVendasPeriodoResumo(
  range: DateRange,
  rankingLimit: number,
  categoriaFiltro?: ProdutoCategoriaKey
): Promise<VendasPeriodoResumo> {
  const [rows, despachoPorSemana] = await Promise.all([
    fetchItensDoPeriodo(range),
    buildDespachoPorSemana(range).catch((err) => {
      console.error("getVendasPeriodoResumo (despacho):", (err as Error).message);
      return new Map<string, number>();
    }),
  ]);

  const vendidoPorSemana = aggregateVendidoPorSemana(rows);

  return {
    ranking: aggregateRankingProdutos(rows, rankingLimit, categoriaFiltro),
    categorias: aggregateVendasPorCategoria(rows),
    evolucaoFamilia: aggregateVendasPorFamiliaLogisticaPorSemana(rows, range),
    vendidoDespachado: segundasNoPeriodo(range).map((semanaIso) => ({
      semanaInicio: semanaIso,
      vendido: vendidoPorSemana.get(semanaIso) ?? 0,
      despachado: despachoPorSemana.get(semanaIso) ?? 0,
    })),
  };
}
