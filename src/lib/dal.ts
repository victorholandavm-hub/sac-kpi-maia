import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { SAC_MANAGED_TYPES } from "./assistenciaLabels";

export type Role = "assistencia" | "admin" | "sac";

export type Profile = {
  id: string;
  fullName: string;
  role: Role;
  storeId: string | null;
};

// Revalida a sessão contra o servidor de Auth do Supabase (não confia só no cookie).
export const verifySession = cache(async () => {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/assistencia/login");
  return user;
});

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await verifySession();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, role, store_id")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    redirect("/assistencia/login");
  }

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role as Role,
    storeId: data.store_id,
  };
});

export function requireRole(profile: Profile, ...roles: Role[]) {
  if (!roles.includes(profile.role)) {
    throw new Error(`Ação não permitida para o papel "${profile.role}".`);
  }
}

// SAC só gerencia notificações/trocas de produto em /assistencia/sac — não
// enxerga a fila normal de montagem/assistência. Chamar no topo de toda
// página do grupo (app) que não seja o detalhe de um chamado específico
// (que o SAC também precisa acessar pros próprios chamados).
export function redirectIfSac(profile: Profile) {
  if (profile.role === "sac") redirect("/assistencia/sac");
}

// Igual a requireRole(profile, "assistencia", "admin", "sac"), mas pro SAC só
// libera se o chamado é de um tipo que ele de fato gerencia (troca_produto /
// notificacao_externa) — sem isso, uma role check sozinha deixaria o SAC
// mexer em qualquer chamado da fila normal, bastando saber o id.
export function requireManageAccess(profile: Profile, requestType: string) {
  if (profile.role === "assistencia" || profile.role === "admin") return;
  if (profile.role === "sac" && (SAC_MANAGED_TYPES as readonly string[]).includes(requestType)) return;
  throw new Error(`Ação não permitida para o papel "${profile.role}" nesse chamado.`);
}

// Regras de transição de status do pedido de encomenda (ver
// supabase/migrations/0027_pedidos_encomenda.sql / 0028_encomenda_pin_auth.sql):
// fábrica só avança solicitado -> em_producao -> pronto_para_expedicao; CD só
// avança daí em diante até entregue. Só admin/assistencia pode cancelar, em
// qualquer etapa. Aceita `{ role: string }` em vez de `Profile` porque CD e
// fábrica não são mais contas Supabase Auth — ver EncomendaActor em
// src/lib/encomendaAuth.ts.
const FABRICA_TRANSITIONS: Record<string, string[]> = {
  solicitado: ["em_producao"],
  em_producao: ["pronto_para_expedicao"],
};

const CD_TRANSITIONS: Record<string, string[]> = {
  pronto_para_expedicao: ["em_carga"],
  em_carga: ["faturado"],
  faturado: ["entregue"],
};

export function requireEncomendaAction(actor: { role: string }, fromStatus: string, toStatus: string) {
  if (actor.role === "assistencia" || actor.role === "admin") return;

  if (toStatus === "cancelado") {
    throw new Error(`Ação não permitida para o papel "${actor.role}" — só admin/assistência pode cancelar um pedido.`);
  }

  const allowed =
    actor.role === "fabrica"
      ? (FABRICA_TRANSITIONS[fromStatus] ?? [])
      : actor.role === "cd"
        ? (CD_TRANSITIONS[fromStatus] ?? [])
        : [];

  if (!allowed.includes(toStatus)) {
    throw new Error(`Ação não permitida para o papel "${actor.role}" nesse pedido.`);
  }
}
