import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type Role = "gerente" | "assistencia" | "admin";

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
