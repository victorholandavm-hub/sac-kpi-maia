import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DRIVER_COOKIE_NAME, verifyDriverSession } from "@/lib/driverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saveRequestPhoto } from "@/lib/servicePhotos";

// Mesmo motivo de /api/montador/upload-photo: motorista também costuma abrir
// o link de dentro do navegador embutido do WhatsApp, que tem bug conhecido
// nesse app com o tipo de resposta em stream que Server Actions usam --
// POST comum com resposta JSON simples é bem mais compatível.
//
// Importante: NÃO importar getDriverSession de driver-actions.ts (arquivo
// "use server") aqui -- isso prendia a rota inteira na maquinaria de
// resolução de Server Action do Next (todo POST virava um redirect 307 pra
// "/assistencia" antes de entrar na função, sem log nenhum -- ver o mesmo
// bug já corrigido em /api/montador/upload-photo). Lê o cookie direto com os
// helpers puros de @/lib/driverAuth.
export async function POST(req: NextRequest) {
  try {
    console.log("[motorista-upload] request recebida");

    const cookieStore = await cookies();
    const driverName = verifyDriverSession(cookieStore.get(DRIVER_COOKIE_NAME)?.value);
    if (!driverName) {
      return NextResponse.json({ error: "Sessão expirada. Faça login de novo." }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o envio. Tente de novo." }, { status: 400 });
    }

    const requestId = String(formData.get("requestId") ?? "");
    if (!requestId) return NextResponse.json({ error: "Chamado inválido." }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: request, error } = await admin
      .from("service_requests")
      .select("driver_name")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request || request.driver_name !== driverName) {
      return NextResponse.json({ error: "Esse chamado não é seu." }, { status: 403 });
    }

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Selecione uma foto." }, { status: 400 });
    }
    const caption = String(formData.get("caption") ?? "");

    try {
      await saveRequestPhoto({ requestId, file, uploadedBy: driverName, caption });
    } catch (err) {
      console.error("[motorista-upload] saveRequestPhoto falhou", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    revalidatePath("/assistencia/motorista");
    console.log("[motorista-upload] sucesso");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[motorista-upload] erro não previsto", err);
    return NextResponse.json({ error: `Erro inesperado no servidor: ${(err as Error)?.message ?? "desconhecido"}` }, { status: 500 });
  }
}
