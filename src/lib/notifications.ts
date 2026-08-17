// Extensão .ts explícita: este arquivo entra na cadeia de import de
// scripts/totvs-sync.ts (via syncRuns.ts), rodado direto via
// `node --env-file` -- mesma nota em totvsSync.ts/syncRuns.ts.
import { getSupabaseAdmin } from "./supabaseAdmin.ts";

export type NotificationRecipientKind = "admin" | "loja" | "fabrica" | "cd" | "sac" | "assistencia";

type CreateNotificationInput = {
  recipientKind: NotificationRecipientKind;
  recipientKey?: string | null;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
};

// Nunca pode derrubar a ação de negócio que disparou a notificação -- mesmo
// espírito de recordSyncRun (syncRuns.ts): é só um efeito colateral de
// observabilidade/aviso, uma falha aqui não pode virar erro pro usuário que
// só queria avançar um status.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("notifications").insert({
      recipient_kind: input.recipientKind,
      recipient_key: input.recipientKey ?? null,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      link: input.link ?? null,
    });
    if (error) console.error("[notifications] falha ao gravar:", error.message);
  } catch (err) {
    console.error("[notifications] falha ao gravar:", (err as Error).message);
  }
}

type NotifyOpts = { type: string; title: string; message?: string | null; link?: string | null };

export async function notifyLoja(storeId: string, opts: NotifyOpts): Promise<void> {
  await createNotification({ recipientKind: "loja", recipientKey: storeId, ...opts });
}

export async function notifyFabrica(fabricaId: string, opts: NotifyOpts): Promise<void> {
  await createNotification({ recipientKind: "fabrica", recipientKey: fabricaId, ...opts });
}

export async function notifyCd(opts: NotifyOpts): Promise<void> {
  await createNotification({ recipientKind: "cd", recipientKey: null, ...opts });
}

export async function notifyAdmin(opts: NotifyOpts): Promise<void> {
  await createNotification({ recipientKind: "admin", recipientKey: null, ...opts });
}

// "sac"/"assistencia": sem recipientKey (broadcast pro papel inteiro, igual
// admin/cd) -- diferente de "loja", que é por loja específica. Usado hoje só
// pelo alerta de "precisa remarcar" (driver-actions.ts/montador-actions.ts),
// roteado por tipo de chamado (ver SAC_MANAGED_TYPES em assistenciaLabels.ts).
export async function notifySac(opts: NotifyOpts): Promise<void> {
  await createNotification({ recipientKind: "sac", recipientKey: null, ...opts });
}

export async function notifyAssistencia(opts: NotifyOpts): Promise<void> {
  await createNotification({ recipientKind: "assistencia", recipientKey: null, ...opts });
}

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  createdAt: string;
};

// recipientKey null busca notificações sem chave (admin/cd); quando o
// chamador tem mais de uma chave relevante (ex: gerente com várias lojas,
// ou Rafael vendo as duas fábricas), chama uma vez por chave e junta o
// resultado -- mantém a query simples em vez de um `in (...)` dinâmico.
export async function listNotifications(
  kind: NotificationRecipientKind,
  key: string | null,
  limit = 20
): Promise<Notification[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("notifications")
    .select("id, type, title, message, link, created_at")
    .eq("recipient_kind", kind)
    .order("created_at", { ascending: false })
    .limit(limit);
  query = key === null ? query.is("recipient_key", null) : query.eq("recipient_key", key);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    createdAt: row.created_at,
  }));
}

// Pra gerente com mais de uma loja, ou Rafael vendo as duas fábricas
// (fabricaId null) -- busca uma lista por chave e junta, mais recente
// primeiro. Evita um `in (...)` dinâmico só pra um caso que já é raro.
export async function listNotificationsForKeys(
  kind: NotificationRecipientKind,
  keys: string[],
  limit = 20
): Promise<Notification[]> {
  const lists = await Promise.all(keys.map((key) => listNotifications(kind, key, limit)));
  return lists
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
