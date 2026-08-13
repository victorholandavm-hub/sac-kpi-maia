// Extensão .ts explícita: este arquivo é importado tanto pelo bundler do
// Next.js quanto por scripts/totvs-sync.ts, rodado direto via
// `node --env-file` (suporte nativo a TS do Node exige extensão explícita
// em todo o encadeamento de imports relativos) -- ver mesma nota em
// totvsSync.ts.
import { getSupabaseAdmin } from "./supabaseAdmin.ts";
import { notifyAdmin } from "./notifications.ts";

export type SyncJob = "totvs" | "ghl" | "backup" | "ai-classify";

const JOB_LABELS: Record<SyncJob, string> = {
  totvs: "TOTVS",
  ghl: "GoHighLevel",
  backup: "Backup diário",
  "ai-classify": "Classificação por IA (SAC)",
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

// Usado pelas próprias rotas de cron (backup, ghl) pra se auto-limitar:
// mesmo que algo dispare a rota com mais frequência do que o previsto (cron
// duplicado, retry externo, etc.), a rota consulta essa única linha antes de
// fazer qualquer leitura pesada no banco -- descoberto em 2026-08-10: egress
// do Supabase estourou a cota do plano Free (6,6 GB de 5 GB) com um banco de
// só 49 MB, sinal de chamada repetida demais, não de dado grande. Consulta
// em si é minúscula (1 linha, 1 coluna) perto do que evita.
export async function getLastSuccessfulRunAt(job: SyncJob): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("sync_runs")
    .select("ran_at")
    .eq("job", job)
    .eq("ok", true)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ran_at ?? null;
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
