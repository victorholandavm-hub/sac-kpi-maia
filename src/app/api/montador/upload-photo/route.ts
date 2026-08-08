import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MONTADOR_COOKIE_NAME, verifyMontadorSession } from "@/lib/montadorAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saveRequestPhoto } from "@/lib/servicePhotos";

// Rota de API tradicional em vez de Server Action chamada direto -- o
// montador quase sempre abre o link de dentro do navegador embutido do
// WhatsApp, que já tem bug conhecido nesse app com streaming de resposta
// (ver NavigationProgressBar.tsx). Server Actions dependem desse mesmo tipo
// de resposta especial (RSC em stream); um POST comum com resposta JSON
// simples é bem mais compatível com esse navegador restrito.
//
// Importante: NÃO importar getMontadorSession de montador-actions.ts (arquivo
// "use server") aqui -- isso prendia essa rota inteira na maquinaria de
// resolução de Server Action do Next (toda requisição virava um redirect 307
// pra "/assistencia" antes até de entrar nessa função, sem log nenhum
// aparecer -- foi isso que causava o "erro 500" que o montador via). Lê o
// cookie direto, com os mesmos helpers puros de @/lib/montadorAuth que
// montador-actions.ts também usa por baixo.
export async function POST(req: NextRequest) {
  try {
    console.log("[montador-upload] request recebida");

    const cookieStore = await cookies();
    const assemblerName = verifyMontadorSession(cookieStore.get(MONTADOR_COOKIE_NAME)?.value);
    if (!assemblerName) {
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
      .select("assembler_name")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request || request.assembler_name !== assemblerName) {
      return NextResponse.json({ error: "Esse chamado não é seu." }, { status: 403 });
    }

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Selecione uma foto." }, { status: 400 });
    }
    const caption = String(formData.get("caption") ?? "");

    console.log("[montador-upload] validado, salvando", { requestId, fileSize: file.size, fileType: file.type });

    try {
      await saveRequestPhoto({ requestId, file, uploadedBy: assemblerName, caption });
    } catch (err) {
      console.error("[montador-upload] saveRequestPhoto falhou", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    revalidatePath("/assistencia/montador");
    revalidatePath(`/assistencia/montador/${requestId}`);
    console.log("[montador-upload] sucesso");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[montador-upload] erro não previsto", err);
    return NextResponse.json({ error: `Erro inesperado no servidor: ${(err as Error)?.message ?? "desconhecido"}` }, { status: 500 });
  }
}
