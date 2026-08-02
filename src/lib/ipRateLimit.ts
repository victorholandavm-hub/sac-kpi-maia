import { getSupabaseAdmin } from "./supabaseAdmin";

export { getClientIp } from "./rateLimit";

// Limiar alto de propósito: o objetivo é travar spray de tentativas
// automatizado (que precisaria de milhares de tentativas pra adivinhar um
// PIN numérico), não atrapalhar uma loja com vários funcionários logando a
// partir do mesmo IP compartilhado (NAT) num intervalo curto.
const MAX_ATTEMPTS = 30;
const WINDOW_MS = 15 * 60 * 1000;

export async function checkIpRateLimit(ip: string): Promise<{ locked: boolean; minutesLeft?: number }> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("login_ip_rate_limit").select("attempts, window_start").eq("ip", ip).maybeSingle();
  if (!data) return { locked: false };

  const windowStart = new Date(data.window_start).getTime();
  if (Date.now() - windowStart > WINDOW_MS) return { locked: false };
  if (data.attempts < MAX_ATTEMPTS) return { locked: false };

  const minutesLeft = Math.ceil((windowStart + WINDOW_MS - Date.now()) / 60000);
  return { locked: true, minutesLeft };
}

// Não reseta no sucesso de propósito -- um IP compartilhado (loja) onde um
// funcionário loga certo não deveria "limpar" tentativas de spray que
// estejam vindo do mesmo IP; a janela só decai com o tempo.
export async function recordFailedIpAttempt(ip: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("login_ip_rate_limit").select("attempts, window_start").eq("ip", ip).maybeSingle();

  if (!data || Date.now() - new Date(data.window_start).getTime() > WINDOW_MS) {
    await admin.from("login_ip_rate_limit").upsert({ ip, attempts: 1, window_start: new Date().toISOString() });
    return;
  }

  await admin.from("login_ip_rate_limit").update({ attempts: data.attempts + 1 }).eq("ip", ip);
}
