// Extensão .ts explícita: este arquivo é importado tanto pelo bundler do
// Next.js quanto por scripts/totvs-sync.ts, rodado direto via
// `node --env-file` (suporte nativo a TS do Node exige extensão explícita
// em todo o encadeamento de imports relativos) -- ver mesma nota em
// totvsSync.ts.
import { getSupabaseAdmin } from "./supabaseAdmin.ts";
import { notifyAdmin } from "./notifications.ts";

export type SyncJob = "totvs" | "ghl" | "backup";

const JOB_LABELS: Record<SyncJob, string> = {
  totvs: "TOTVS",
  ghl: "GoHighLevel",
  backup: "Backup diário",
};

// Só observabilidade -- uma falha ao gravar o histórico nunca pode derrubar
// o job em si, senão vira mais um jeito de sync quebrar sem ninguém notar.
export async function recordSyncRun(
  job: SyncJob,
  ok: boolean,
  summary: Record<string, unknown>,
  errors: string[] = []
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("sync_runs").insert({ job, ok, summary, errors });
    if (error) console.error(`[syncRuns] falha ao gravar histórico de "${job}":`, error.message);
  } catch (err) {
    console.error(`[syncRuns] falha ao gravar histórico de "${job}":`, (err as Error).message);
  }

  if (!ok) {
    await notifyAdmin({
      type: "sync_error",
      title: `Sincronização "${JOB_LABELS[job]}" falhou`,
      message: errors.join(" · ") || null,
      link: "/assistencia/admin",
    });
  }
}

export type LatestSyncRun = { job: SyncJob; ok: boolean; ranAt: string; errors: string[] };

// Uma linha por job (a mais recente) -- não dá pra fazer "distinct on" via
// supabase-js, então busca as últimas rodadas de todos os jobs juntas e
// reduz em memória (poucos jobs, poucas linhas, sem custo real).
export async function listLatestSyncRuns(): Promise<LatestSyncRun[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("sync_runs").select("job, ok, ran_at, errors").order("ran_at", { ascending: false }).limit(30);

  const seen = new Set<string>();
  const latest: LatestSyncRun[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.job)) continue;
    seen.add(row.job);
    latest.push({ job: row.job as SyncJob, ok: row.ok, ranAt: row.ran_at, errors: row.errors ?? [] });
  }
  return latest;
}
