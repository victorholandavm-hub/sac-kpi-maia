import { getSupabaseAdmin } from "./supabaseAdmin";

// Tela "Vendas por produto" (admin + CD, ver 0073_vendas_produto_rls.sql):
// curva semanal de um produto, ranking dos mais vendidos e classificação por
// tipo (colchão, roupeiro...), em cima do histórico de NFs já sincronizado
// do TOTVS (totvs_orders/totvs_order_items, ver 0039_totvs_sync.sql).
// Quantidade é sempre a SOMA líquida (venda + devolução) -- devolução já
// vem com quantidade negativa no payload da TOTVS, então somar direto já dá
// o volume líquido vendido, sem precisar tratar os dois tipos separado.

// Cada semana bucket pela SEGUNDA-feira daquela semana -- rótulo estável,
// não depende de qual dia da semana é "hoje" quando a tela é aberta.
function segundaFeiraDe(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const dow = d.getDay(); // 0=domingo..6=sábado
  const diff = (dow === 0 ? -6 : 1) - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// A API do TOTVS não traz categoria/família de produto nenhuma (conferido
// no schema documentado de /rest/orders) -- só código e descrição em texto
// livre. Classificação por palavra-chave na descrição, primeira que bater
// (ordem importa: "COLCHAO" antes de "BOX" evita cruzar "protetor de
// colchão" com box, por ex.). Aproximado por natureza -- fácil de ajustar
// essa lista depois se algum produto cair na categoria errada.
export const PRODUTO_CATEGORIAS = [
  {
    key: "colchao",
    label: "Colchão",
    keywords: ["COLCHAO", "COLCHÃO", "COLCHONETE", "COL ", "TRAV ", "TRAVESSEIRO", "PROTETOR", "PILLOW"],
  },
  { key: "box_base", label: "Box / Base", keywords: ["BOX", "BASE TOP", "FL BASE", "BAU "] },
  { key: "cama", label: "Cama / Beliche / Cabeceira", keywords: ["BELICHE", "CABECEIRA", "CAMA "] },
  { key: "roupeiro", label: "Roupeiro / Armário", keywords: ["ROUPEIRO", "ROUP ", "ARMARIO", "ARMÁRIO", "MULTI-USO", "MULTIUSO", "GUARDA-ROUPA", "GUARDA ROUPA"] },
  { key: "comoda", label: "Cômoda", keywords: ["COMODA", "CÔMODA"] },
  { key: "cozinha", label: "Cozinha", keywords: ["COZINHA", "BALCAO", "BALCÃO", "PANELEIRO", "FRUTEIRA"] },
  { key: "sala_jantar", label: "Sala de estar / jantar", keywords: ["SOFA", "SOFÁ", "POLTRONA", "CRISTALEIRA", "BUFFET", "ESTOFADO"] },
  { key: "mesa_cadeira", label: "Mesa / Cadeira", keywords: ["MESA", "CADEIRA", "CONJ."] },
  { key: "estante_home", label: "Estante / Home / Rack", keywords: ["HOME", "RACK", "ESTANTE", "APARADOR"] },
] as const;

export type ProdutoCategoriaKey = (typeof PRODUTO_CATEGORIAS)[number]["key"] | "outros";

export function classificarProduto(description: string | null): { key: ProdutoCategoriaKey; label: string } {
  const upper = (description ?? "").toUpperCase();
  for (const cat of PRODUTO_CATEGORIAS) {
    if (cat.keywords.some((k) => upper.includes(k))) return { key: cat.key, label: cat.label };
  }
  return { key: "outros", label: "Outros" };
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
// página só (um produto específico, poucas semanas, não precisa paginar).
export async function getVendaCurvaProduto(productCode: string, numSemanas: number): Promise<ProdutoVendaCurva | null> {
  const trimmed = productCode.trim();
  if (!trimmed) return null;

  const admin = getSupabaseAdmin();
  const cutoff = isoDaysAgo(numSemanas * 7);

  const { data, error } = await admin
    .from("totvs_order_items")
    .select("quantity, total, description, totvs_orders!inner(issue_date)")
    .eq("product", trimmed)
    .gte("totvs_orders.issue_date", cutoff)
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

  return buildCurva(trimmed, description, rows, numSemanas);
}

function buildCurva(productCode: string, description: string | null, rows: ItemComData[], numSemanas: number): ProdutoVendaCurva {
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
  // impressão errada de que a semana nem existiu. Da semana mais antiga
  // (hoje - numSemanas) até a semana atual, em ordem crescente.
  const semanas: SemanaVenda[] = [];
  const hojeSemana = segundaFeiraDe(new Date().toISOString().slice(0, 10));
  const cursor = new Date(`${hojeSemana}T00:00:00`);
  cursor.setDate(cursor.getDate() - (numSemanas - 1) * 7);
  for (let i = 0; i < numSemanas; i++) {
    const semanaIso = cursor.toISOString().slice(0, 10);
    const acc = porSemana.get(semanaIso) ?? { quantidade: 0, valor: 0 };
    semanas.push({ semanaInicio: semanaIso, quantidade: acc.quantidade, valor: acc.valor });
    cursor.setDate(cursor.getDate() + 7);
  }

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

type ItemRankingRow = { product: string | null; description: string | null; quantity: number; total: number };

// Todo o histórico do período cabe em memória pra agregar (ranking geral E
// por categoria) -- paginado de verdade (não confia no default de 1000
// linhas do PostgREST): num período de várias semanas, o total de itens
// pode passar disso fácil. Corta em MAX_PAGINAS por segurança (nunca deve
// bater nisso com o volume atual, mas evita loop sem fim se um dia bater).
const RANKING_PAGE_SIZE = 1000;
const RANKING_MAX_PAGINAS = 30;

async function fetchItensDoPeriodo(numSemanas: number): Promise<ItemRankingRow[]> {
  const admin = getSupabaseAdmin();
  const cutoff = isoDaysAgo(numSemanas * 7);

  const rows: ItemRankingRow[] = [];
  for (let pagina = 0; pagina < RANKING_MAX_PAGINAS; pagina++) {
    const from = pagina * RANKING_PAGE_SIZE;
    const { data, error } = await admin
      .from("totvs_order_items")
      .select("product, description, quantity, total, totvs_orders!inner(issue_date)")
      .gte("totvs_orders.issue_date", cutoff)
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
// classificados nela (ver classificarProduto).
export async function listRankingProdutos(
  numSemanas: number,
  limit: number,
  categoria?: ProdutoCategoriaKey
): Promise<ProdutoRankingItem[]> {
  const rows = await fetchItensDoPeriodo(numSemanas);

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

export type CategoriaResumo = { key: ProdutoCategoriaKey; label: string; quantidade: number; valor: number };

// Visão "por tipo de produto" -- resposta direta ao que a tela não tinha
// antes (só listava produto por produto, sem dar pra comparar categoria
// contra categoria de cara).
export async function listVendasPorCategoria(numSemanas: number): Promise<CategoriaResumo[]> {
  const rows = await fetchItensDoPeriodo(numSemanas);

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
