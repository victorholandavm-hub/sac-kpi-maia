import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getCdSession } from "@/app/assistencia/cd-actions";

export type FornecedorPedidoActor = { name: string; role: "cd" | "admin" | "assistencia" };

// Pedido a fornecedor externo é responsabilidade do CD -- fábrica (mesmo
// quando é a mesma pessoa, como o Rafael) não entra aqui, já que essa tela é
// sobre comprar reposição de fora, não sobre produzir/expedir o que a loja
// pediu (isso é o módulo de Encomendas, ver encomendaAuth.ts). Admin/
// assistência têm acesso de supervisão, mesmo padrão de requireEncomendaActor.
export async function requireFornecedorPedidoActor(): Promise<FornecedorPedidoActor> {
  const cdName = await getCdSession();
  if (cdName) return { name: cdName, role: "cd" };

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    if (data && (data.role === "admin" || data.role === "assistencia")) {
      return { name: data.full_name, role: data.role };
    }
  }

  redirect("/assistencia/encomendas");
}
