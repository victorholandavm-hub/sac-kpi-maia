import { createClient } from "@supabase/supabase-js";

// DIAGNÓSTICO TEMPORÁRIO 30/09/2026 -- remover depois de achar a causa raiz
// do "TypeError: fetch failed" persistente em /kpis-assistencia. supabase-js
// captura essa exceção internamente (nunca escapa como throw, ver
// supabasePagination.ts) -- só dá pra ver o .cause de verdade interceptando
// o fetch usado por dentro do client via a opção `global.fetch`.
async function diagnosticFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    console.error("[supabaseAdmin] fetch cru falhou:", {
      message: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error ? err.cause : undefined,
      url,
    });
    throw err;
  }
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars ausentes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: diagnosticFetch },
  });
}
