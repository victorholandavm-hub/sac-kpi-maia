// Busca TODAS as páginas de uma consulta em PARALELO, não uma esperando a
// anterior -- achado 19/08/2026 (investigação de performance, pedido do
// Victor: "as páginas estão demorando muito a carregar"). Várias telas
// (vendas, clientes, KPIs) buscavam até 30-200 páginas SEQUENCIAIS de uma
// vez (cada .range() é uma ida e volta separada ao Supabase, ~150-500ms
// cada) -- somado, 15-20s+ de carregamento (medido: /vendas 20s, /clientes
// 15.8s, /kpis 5.8s). Busca a 1ª página pedindo count exato (`{ count:
// "exact" }` no .select() de quem chama), calcula quantas páginas faltam e
// dispara todas de uma vez via Promise.all -- o tempo total vira "o mais
// lento dos paralelos", não a soma de todos.
//
// Quem chama precisa passar `{ count: "exact" }` no próprio .select() --
// esse helper só orquestra o .range()/Promise.all por cima, não construção
// da query em si (cada tabela filtra diferente demais pra generalizar isso
// também).
export type PagedQueryResult<T> = { data: T[] | null; error: { message: string } | null; count?: number | null };

const DEFAULT_PAGE_SIZE = 1000;

export async function fetchAllPagesParallel<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedQueryResult<T>>,
  opts: { pageSize?: number } = {}
): Promise<T[]> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const first = await fetchPage(0, pageSize - 1);
  if (first.error) throw new Error(first.error.message);
  const firstRows = (first.data ?? []) as T[];

  // Sem count (query não pediu "exact") ou página já veio incompleta --
  // não tem mais nada pra buscar.
  if (first.count == null || firstRows.length < pageSize) return firstRows;

  const totalPages = Math.ceil(first.count / pageSize);
  if (totalPages <= 1) return firstRows;

  const restResults = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => {
      const from = (i + 1) * pageSize;
      return fetchPage(from, from + pageSize - 1);
    })
  );

  const rows = firstRows.slice();
  for (const r of restResults) {
    if (r.error) throw new Error(r.error.message);
    rows.push(...((r.data ?? []) as T[]));
  }
  return rows;
}
