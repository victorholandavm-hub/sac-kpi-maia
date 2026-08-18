import { getSupabaseAdmin } from "./supabaseAdmin";

// Achado 18/08/2026: gerar uma URL assinada nova a cada leitura (mesmo sem a
// foto ter mudado) fazia o navegador baixar a foto inteira de novo toda vez
// -- a página de fila de encomendas atualiza sozinha a cada 15s
// (RealtimeQueueRefresher), então uma tela deixada aberta gerava centenas de
// downloads repetidos da mesma foto (achada uma com 1025 downloads no mesmo
// dia, consumindo praticamente todo o egress do mês do Supabase). Reusar a
// URL enquanto ela não estiver perto de vencer resolve isso -- mesma URL
// entre atualizações, o navegador cacheia normalmente.
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // regera se faltar menos de 5min pro vencimento

export async function getCachedSignedUrl(opts: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  bucket: string;
  table: string;
  id: string;
  storagePath: string;
  cachedUrl: string | null;
  cachedExpiresAt: string | null;
  ttlSeconds: number;
}): Promise<string> {
  const { admin, bucket, table, id, storagePath, cachedUrl, cachedExpiresAt, ttlSeconds } = opts;

  if (cachedUrl && cachedExpiresAt && new Date(cachedExpiresAt).getTime() - REFRESH_MARGIN_MS > Date.now()) {
    return cachedUrl;
  }

  const { data: signed } = await admin.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds);
  const url = signed?.signedUrl ?? "";
  if (url) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    // Best-effort -- se essa gravação falhar, a próxima leitura só gera de
    // novo (volta ao comportamento antigo pra essa foto específica, não
    // trava nada).
    await admin.from(table).update({ signed_url: url, signed_url_expires_at: expiresAt }).eq("id", id);
  }
  return url;
}
