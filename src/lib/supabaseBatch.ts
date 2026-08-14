// PostgREST manda o `.in("col", valores)` inteiro na URL da requisição --
// com muitos valores (IDs UUID, 36 chars cada), a URL passa fácil dos
// ~16KB de limite de cabeçalho HTTP e a chamada quebra com
// HeadersOverflowError, derrubando a página inteira que dependia dela.
// Bug real em produção 14/08/2026, achado em três lugares diferentes
// (kpi.ts, entregasRisco.ts, emAndamento.ts) -- extraído aqui pra não
// reescrever o mesmo lote pela quarta vez. Lote pequeno o bastante pra
// nunca chegar perto do limite, buscado em paralelo.
const IN_FILTER_BATCH_SIZE = 200;

export async function fetchInBatches<T>(
  values: string[],
  fetchBatch: (batch: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  if (values.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < values.length; i += IN_FILTER_BATCH_SIZE) {
    batches.push(values.slice(i, i + IN_FILTER_BATCH_SIZE));
  }

  const responses = await Promise.all(batches.map(fetchBatch));
  const result: T[] = [];
  for (const { data, error } of responses) {
    if (error) throw new Error(error.message);
    result.push(...(data ?? []));
  }
  return result;
}
