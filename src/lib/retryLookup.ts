// Fallback pra falha passageira (rede/Supabase) nas buscas por código do
// TOTVS (cliente/produto) -- só faz sentido tentar de novo automaticamente
// quando a chamada de fato falhou (exception). Quando ela responde
// certinho "não achei nada", o dado genuinamente ainda não chegou no nosso
// banco (sync do TOTVS) -- tentar de novo no mesmo segundo não muda nada,
// por isso esse caso continua exposto como "não encontrado" no formulário,
// com um botão de tentar de novo manual pro usuário usar depois de
// esperar um pouco (ver SacCreateRequestForm.tsx etc.). O que resolve o
// atraso de sincronização de verdade é a frequência do sync em si (ajustada
// de 1x/dia pra 30min em 2026-08-13), não retry na hora.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}
