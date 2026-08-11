import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getCdSession } from "@/app/assistencia/cd-actions";

export type VendasActor = { name: string; role: "cd" | "admin" };

// Quem pode ver a tela "Vendas por produto": CD (sessão PIN, sem Supabase
// Auth) ou admin (perfil Supabase Auth) -- só esses dois papéis, por pedido
// explícito do Victor. Mesmo princípio de requireEncomendaActor
// (encomendaAuth.ts): tenta a sessão de CD primeiro, depois um perfil
// Supabase Auth; página fica FORA do grupo (app) porque CD não tem sessão
// Supabase Auth pra getProfile() (dal.ts) resolver.
export async function requireVendasActor(): Promise<VendasActor> {
  const cdName = await getCdSession();
  if (cdName) return { name: cdName, role: "cd" };

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    if (data && data.role === "admin") {
      return { name: data.full_name, role: "admin" };
    }
  }

  redirect("/assistencia");
}
