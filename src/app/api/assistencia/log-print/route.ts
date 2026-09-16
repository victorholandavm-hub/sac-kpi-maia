import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, type Profile, type Role } from "@/lib/dal";

// Rota de API tradicional em vez de Server Action (era logPrint, actions.ts)
// -- pedido do Victor 16/09/2026: "o botão de imprimir não funciona,
// funciona apenas quando aperto ctrl + P". Mesma causa raiz já corrigida em
// /api/staff/upload-photo (ver comentário lá, 26/08/2026): Server Action
// guarda um ID específico do build; um deploy novo (frequente nesta base)
// invalida quem já estava com a tela de despacho aberta de antes. O
// PrintButton chamava `logPrint(ids)` (Server Action) sem esperar, mas o
// PRÓPRIO CHAMAR já lança "Failed to find Server Action" de forma síncrona
// quando o ID não bate mais com o build atual -- isso acontecia ANTES de
// chegar em `window.print()` na linha seguinte, o `.catch()` só pega
// rejeição de promise, não essa exceção síncrona, e o clique inteiro
// morria ali, sem print nenhum e sem erro visível (só no console). Ctrl+P
// nunca passava por esse código, por isso sempre funcionava. POST comum
// não tem esse problema -- a rota em si não muda de "id" a cada deploy.
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão expirada. Atualize a página e faça login de novo." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: profileRow } = await admin.from("profiles").select("id, full_name, role, store_id").eq("id", user.id).maybeSingle();
    if (!profileRow) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 401 });
    }
    const profile: Profile = { id: profileRow.id, fullName: profileRow.full_name, role: profileRow.role as Role, storeId: profileRow.store_id };

    try {
      requireRole(profile, "assistencia", "admin", "sac");
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }

    let body: { requestIds?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o envio." }, { status: 400 });
    }

    const ids = (Array.isArray(body.requestIds) ? body.requestIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("service_request_events").insert(
      ids.map((id) => ({
        request_id: id,
        actor_id: profile.id,
        event_type: "printed",
      }))
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: `Erro inesperado no servidor: ${(err as Error)?.message ?? "desconhecido"}` }, { status: 500 });
  }
}
