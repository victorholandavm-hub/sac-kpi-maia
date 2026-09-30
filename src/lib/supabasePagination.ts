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

// Disparar dezenas de páginas em paralelo (ver comentário acima) significa
// dezenas de conexões simultâneas ao Supabase -- uma falha de rede
// transitória numa única página (TypeError: fetch failed, achado
// 28/09/2026 investigando "Minified React error #441" em /kpis, digest
// 1801967253) derrubava a promise inteira do Promise.all, sem chance de
// recuperação, e o erro cru (fetch() rejeitado, nem chega a virar
// PagedQueryResult.error) subia até estourar o boundary de erro do React.
// 1 nova tentativa (com um pequeno atraso) cobre o caso comum de blip de
// rede sem esconder um erro persistente de verdade (esse continua
// propagando depois da 2ª falha).
// Limite GLOBAL de conexões simultâneas (não por chamada de
// fetchAllPagesParallel) -- achado 30/09/2026 (Victor: "ta dando erro no
// painel de kpis quando tento ir para a aba de assistencia", 2ª causa
// depois do fix do payload > 2MB): mesmo com o pool do PostgREST
// triplicado e a MESMA query respondendo em 16ms via curl direto contra o
// gateway (confirmado que o servidor não é o gargalo), a página seguia
// derrubando com "TypeError: fetch failed". Causa real: computeAssistenciaKpiData
// dispara ~7 fetchAllPagesParallel em paralelo via Promise.all, cada um
// com suas próprias páginas paralelas por cima -- uma rajada de dezenas
// de conexões de uma vez só, do MESMO processo Node, que algo na cadeia
// Node -> Envoy (gateway self-hosted) não aguenta em rajada mesmo com
// espaço de sobra em cada ponta isoladamente. Um semáforo simples aqui
// (nível mais baixo, cobre TODA fetchAllPagesParallel do app, não só
// desta tela) limita quantas págimas ficam EM VOO ao mesmo tempo,
// sem reintroduzir cache nenhum.
const MAX_CONCURRENT_FETCHES = 8;
let activeFetches = 0;
const fetchQueue: (() => void)[] = [];

function acquireFetchSlot(): Promise<void> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches++;
    return Promise.resolve();
  }
  return new Promise((resolve) => fetchQueue.push(resolve));
}

function releaseFetchSlot(): void {
  activeFetches--;
  const next = fetchQueue.shift();
  if (next) {
    activeFetches++;
    next();
  }
}

async function fetchPageWithRetry<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedQueryResult<T>>,
  from: number,
  to: number
): Promise<PagedQueryResult<T>> {
  await acquireFetchSlot();
  try {
    try {
      return await fetchPage(from, to);
    } catch (err) {
      if (!(err instanceof TypeError) || !/fetch/i.test(err.message)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return await fetchPage(from, to);
    }
  } finally {
    releaseFetchSlot();
  }
}

export async function fetchAllPagesParallel<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedQueryResult<T>>,
  opts: { pageSize?: number } = {}
): Promise<T[]> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const first = await fetchPageWithRetry(fetchPage, 0, pageSize - 1);
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
      return fetchPageWithRetry(fetchPage, from, from + pageSize - 1);
    })
  );

  const rows = firstRows.slice();
  for (const r of restResults) {
    if (r.error) throw new Error(r.error.message);
    rows.push(...((r.data ?? []) as T[]));
  }
  return rows;
}
