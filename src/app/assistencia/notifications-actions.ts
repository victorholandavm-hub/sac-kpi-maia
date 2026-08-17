"use server";

import { getProfile } from "@/lib/dal";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { resolveEncomendaRequester } from "@/lib/encomendaRequester";
import { INTERNAL_FABRICAS } from "@/lib/fabricas";
import { listNotifications, listNotificationsForKeys, type Notification } from "@/lib/notifications";

// Cada action resolve o destinatário a partir da PRÓPRIA sessão (cookie/PIN
// já validado), nunca de um parâmetro vindo do client -- senão daria pra
// qualquer sessão de loja pedir a notificação de outra loja só trocando o
// argumento. Mesmo padrão de autorização já usado no resto do app (ver
// requireEncomendaAction, canEditPedido).

// getProfile/requireEncomendaActor dão redirect() quando não há sessão
// válida -- aceitável numa página normal, mas isso aqui é chamado em
// polling de fundo (ver NotificationBell); um redirect disparado por uma
// sessão que expirou entre um poll e outro tiraria a pessoa da tela sem
// aviso. Falha fechada (retorna lista vazia) em vez de deixar propagar.
async function safeAdminProfile() {
  try {
    return await getProfile();
  } catch {
    return null;
  }
}

async function safeEncomendaActor() {
  try {
    return await requireEncomendaActor();
  } catch {
    return null;
  }
}

export async function listAdminNotificationsAction(): Promise<Notification[]> {
  const profile = await safeAdminProfile();
  if (!profile || profile.role !== "admin") return [];
  return listNotifications("admin", null);
}

export async function listSacNotificationsAction(): Promise<Notification[]> {
  const profile = await safeAdminProfile();
  if (!profile || profile.role !== "sac") return [];
  return listNotifications("sac", null);
}

// Sino da equipe assistência ((app)/layout.tsx, cobre fila/agenda/admin
// etc.) -- admin também gerencia esse lado, então vê os dois tipos juntos
// (kind "assistencia" + os alertas de admin que já existiam, ex.: falha de
// sync em syncRuns.ts) num sino só, em vez de dois sinos separados. Quem é
// só "assistencia" (não-admin) vê só o próprio.
export async function listAssistenciaTeamNotificationsAction(): Promise<Notification[]> {
  const profile = await safeAdminProfile();
  if (!profile) return [];
  if (profile.role === "admin") {
    const [admin, assistencia] = await Promise.all([listNotifications("admin", null), listNotifications("assistencia", null)]);
    return [...admin, ...assistencia].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
  }
  if (profile.role === "assistencia") return listNotifications("assistencia", null);
  return [];
}

// Cobre tanto /assistencia/loja (gerente) quanto /assistencia/encomendas/caixa
// (caixa ou gerente) -- resolveEncomendaRequester já tenta as duas sessões.
export async function listLojaNotificationsAction(): Promise<Notification[]> {
  const requester = await resolveEncomendaRequester();
  if (!requester) return [];
  if (requester.kind === "gerente") return listNotificationsForKeys("loja", requester.storeIds);
  if (requester.kind === "caixa") return listNotifications("loja", requester.storeId);
  return [];
}

// Cobre /assistencia/encomendas/fila pros papéis fábrica e CD.
export async function listFabricaOuCdNotificationsAction(): Promise<Notification[]> {
  const actor = await safeEncomendaActor();
  if (!actor) return [];
  if (actor.role === "fabrica") {
    const fabricaIds = actor.fabricaId ? [actor.fabricaId] : INTERNAL_FABRICAS.map((f) => f.id);
    return listNotificationsForKeys("fabrica", fabricaIds);
  }
  if (actor.role === "cd") return listNotifications("cd", null);
  return [];
}
