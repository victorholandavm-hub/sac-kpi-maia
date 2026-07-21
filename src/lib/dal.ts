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
