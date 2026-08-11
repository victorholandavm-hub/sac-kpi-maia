import { getSupabaseAdmin } from "./supabaseAdmin";

// Tela "Vendas por produto" (admin + CD, ver 0073_vendas_produto_rls.sql):
// curva semanal de um produto e ranking dos mais vendidos, em cima do
// histórico de NFs já sincronizado do TOTVS (totvs_orders/totvs_order_items,
// ver 0039_totvs_sync.sql). Quantidade é sempre a SOMA líquida (venda +
// devolução) -- devolução já vem com quantidade negativa no payload da
// TOTVS (confirmado no schema da API), então somar direto já dá o volume
// líquido vendido, sem precisar tratar os dois tipos separado.

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
export type ProdutoVendaCurva = { productCode: string; description: string | null; semanas: SemanaVenda[] };

type ItemComData = {
  quantity: number;
  total: number;
  description: string | null;
  totvs_orders: { issue_date: string } | null;
};

// Curva semanal de UM produto -- todas as linhas do período cabem numa
// página só (um produto específico, poucas semanas, não precisa paginar).
export async function getVendaCurvaProduto(productCode: string, numSemanas = 12): Promise<ProdutoVendaCurva | null> {
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
  if (rows.length === 0) {
    // Produto pode existir (catálogo veio de vendas antigas) mas sem
    // movimento no período -- ainda assim mostra a curva zerada em vez de
    // "produto não encontrado", que seria enganoso.
    const { data: anyRow } = await admin.from("totvs_order_items").select("description").eq("product", trimmed).limit(1).maybeSingle();
    if (!anyRow) return null;
    return buildCurva(trimmed, anyRow.description, [], numSemanas);
  }

  return buildCurva(trimmed, rows[0].description, rows, numSemanas);
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

  return { productCode, description, semanas };
}

export type ProdutoRankingItem = { productCode: string; description: string | null; quantidade: number; valor: number };

type ItemRankingRow = { product: string | null; description: string | null; quantity: number; total: number };

// Ranking geral -- paginado de verdade (não confia no default de 1000
// linhas do PostgREST): num período de várias semanas, o total de itens
// pode passar disso fácil. Corta em MAX_PAGINAS por segurança (nunca deve
// bater nisso com o volume atual, mas evita loop sem fim se um dia bater).
const RANKING_PAGE_SIZE = 1000;
const RANKING_MAX_PAGINAS = 20;

export async function listRankingProdutos(numSemanas = 4, limit = 20): Promise<ProdutoRankingItem[]> {
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

  const porProduto = new Map<string, ProdutoRankingItem>();
  for (const row of rows) {
    if (!row.product) continue;
    const acc = porProduto.get(row.product) ?? { productCode: row.product, description: row.description, quantidade: 0, valor: 0 };
    acc.quantidade += row.quantity;
    acc.valor += row.total;
    if (!acc.description && row.description) acc.description = row.description;
    porProduto.set(row.product, acc);
  }

  return [...porProduto.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, limit);
}
