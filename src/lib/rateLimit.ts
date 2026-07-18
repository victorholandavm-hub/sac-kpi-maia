import { headers } from "next/headers";
import { getSupabaseAdmin } from "./supabaseAdmin";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_SUBMISSIONS = 5;

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() ?? "unknown";
}

// Limite simples por IP no formulário público de solicitação (/assistencia/solicitar),
// que não tem login nenhum — sem isso, qualquer um consegue inundar a fila com
// solicitações falsas sem limite algum.
export async function checkAndRecordPublicSubmission(ipAddress: string): Promise<{ allowed: boolean }> {
  const admin = getSupabaseAdmin();

  // limpeza oportunista: não deixa a tabela crescer pra sempre
  await admin.from("public_request_submissions").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await admin
    .from("public_request_submissions")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_SUBMISSIONS) {
    return { allowed: false };
  }

  await admin.from("public_request_submissions").insert({ ip_address: ipAddress });
  return { allowed: true };
}
