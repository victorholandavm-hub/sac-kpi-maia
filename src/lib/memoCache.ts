// Cache em memória (Map por processo) pra substituir unstable_cache --
// achado 30/09/2026 (Victor: "ta dando erro no painel de kpis quando tento
// ir para a aba de assistencia"): o Next.js Data Cache (por trás de
// unstable_cache) recusa gravar qualquer entrada acima de 2MB, e QUALQUER
// unstable_cache ainda ativo no caminho de uma rota contribui pra essa
// mesma gravação -- mesmo uma função pequena (poucas linhas de retorno)
// pode empurrar o total combinado da rota acima do teto se rodar junto de
// outras (ver kpiAssistencia.ts/vendasProduto.ts/serviceRequests.ts, 3
// funções diferentes precisaram sair do unstable_cache pra /kpis-assistencia
// parar de quebrar). Sem esse teto, mesmo balde de tempo de sempre.
type CacheEntry<T> = { value: T; expiresAt: number };

export function memoizeWithTtl<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  ttlMs: number,
  keyFn: (...args: Args) => string = (...args) => JSON.stringify(args)
): (...args: Args) => Promise<T> {
  const cache = new Map<string, CacheEntry<T>>();

  return async (...args: Args): Promise<T> => {
    const key = keyFn(...args);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const value = await fn(...args);

    for (const [k, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(k);
    }
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  };
}
