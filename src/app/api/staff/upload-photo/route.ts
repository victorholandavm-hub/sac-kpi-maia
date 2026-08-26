import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, requireManageAccess, type Profile, type Role } from "@/lib/dal";
import { saveRequestPhoto } from "@/lib/servicePhotos";

// Rota de API tradicional em vez de Server Action chamada direto (que era
// addRequestPhoto, actions.ts, usada por RequestPhotoUpload.tsx) -- mesmo
// motivo já corrigido em /api/montador/upload-photo e
// /api/motorista/upload-photo: Server Action guarda um ID específico do
// build; toda vez que sai um deploy (frequente nesta base -- várias telas
// por dia), quem já estava com a tela de um chamado aberta de antes passa a
// chamar um ID que não existe mais no servidor novo. Confirmado direto nos
// logs de produção: "Error: Failed to find Server Action ... This request
// might be from an older or newer deployment" -- pedido do Victor
// 26/08/2026: "montador e assistencia estão dizendo que nao estao
// conseguindo adicionar fotos nas solicitações". Um POST comum não tem esse
// problema -- a rota em si não muda de "id" a cada deploy.
//
// Não usa getProfile()/verifySession() (dal.ts) aqui -- essas duas chamam
// redirect() quando não há sessão, o que faria um fetch() dessa rota
// terminar seguindo um redirect pra página de login (HTML), não um JSON
// limpo de erro. Lê a sessão do Supabase direto (getSupabaseServer) e
// devolve 401 explícito, mesmo padrão de erro em JSON que
// montador/motorista já usam.
export async function POST(req: NextRequest) {
  try {
    console.log("[staff-upload] request recebida");

    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[staff-upload] sem sessão Supabase");
      return NextResponse.json({ error: "Sessão expirada. Atualize a página e faça login de novo." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: profileRow } = await admin.from("profiles").select("id, full_name, role, store_id").eq("id", user.id).maybeSingle();
    if (!profileRow) {
      console.warn("[staff-upload] perfil não encontrado", { userId: user.id });
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 401 });
    }
    const profile: Profile = { id: profileRow.id, fullName: profileRow.full_name, role: profileRow.role as Role, storeId: profileRow.store_id };

    try {
      requireRole(profile, "assistencia", "admin", "sac");
    } catch (err) {
      console.warn("[staff-upload] papel não permitido", { role: profile.role });
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.warn("[staff-upload] formData falhou", (err as Error).message);
      return NextResponse.json({ error: "Não foi possível ler o envio. Tente de novo." }, { status: 400 });
    }

    const requestId = String(formData.get("requestId") ?? "");
    if (!requestId) {
      console.warn("[staff-upload] requestId ausente");
      return NextResponse.json({ error: "Chamado inválido." }, { status: 400 });
    }

    const { data: current, error: fetchError } = await admin.from("service_requests").select("type").eq("id", requestId).single();
    if (fetchError || !current) {
      console.warn("[staff-upload] chamado não encontrado", { requestId });
      return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    }
    try {
      requireManageAccess(profile, current.type);
    } catch (err) {
      console.warn("[staff-upload] sem acesso ao tipo de chamado", { requestId, type: current.type, role: profile.role });
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      console.warn("[staff-upload] sem arquivo válido", { requestId, temArquivo: file instanceof File });
      return NextResponse.json({ error: "Selecione uma foto." }, { status: 400 });
    }
    const caption = String(formData.get("caption") ?? "");

    console.log("[staff-upload] validado, salvando", { requestId, fileSize: file.size, fileType: file.type });

    try {
      await saveRequestPhoto({ requestId, file, uploadedBy: profile.fullName, caption });
    } catch (err) {
      console.error("[staff-upload] saveRequestPhoto falhou", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    revalidatePath(`/assistencia/${requestId}`);
    console.log("[staff-upload] sucesso");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[staff-upload] erro não previsto", err);
    return NextResponse.json({ error: `Erro inesperado no servidor: ${(err as Error)?.message ?? "desconhecido"}` }, { status: 500 });
  }
}
