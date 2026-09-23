import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FINANCEIRO_COOKIE_NAME, verifyFinanceiroSession } from "@/lib/financeiroAuth";
import { getOptionalProfile } from "@/lib/dal";
import { uploadPendingRequestPhoto } from "@/lib/servicePhotos";
import { marcarEstornoConcluido } from "@/lib/estornoRequests";

// Rota de API tradicional em vez de Server Action -- mesmo motivo de
// /api/montador/upload-photo (não importar getFinanceiroSession de
// financeiro-actions.ts, "use server", aqui: prendia a rota inteira na
// resolução de Server Action do Next). Lê o cookie financeiro direto com
// os helpers puros de @/lib/financeiroAuth; admin (Supabase Auth) também
// pode concluir, mesmo fallback de lojaApproveMontagemConclusion.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(FINANCEIRO_COOKIE_NAME)?.value;
    let actorName = verifyFinanceiroSession(rawCookie);

    if (!actorName) {
      const profile = await getOptionalProfile();
      if (profile && profile.role === "admin") actorName = `${profile.fullName} (admin)`;
    }
    if (!actorName) {
      return NextResponse.json({ error: "Sessão expirada. Faça login de novo." }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o envio. Tente de novo." }, { status: 400 });
    }

    const requestId = String(formData.get("requestId") ?? "");
    if (!requestId) {
      return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
    }

    const file = formData.get("comprovante");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Selecione o comprovante do estorno." }, { status: 400 });
    }

    let comprovantePath: string;
    try {
      comprovantePath = await uploadPendingRequestPhoto(requestId, file);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    try {
      await marcarEstornoConcluido(requestId, actorName, comprovantePath);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    revalidatePath("/assistencia/financeiro");
    revalidatePath("/assistencia/estornos");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: `Erro inesperado no servidor: ${(err as Error)?.message ?? "desconhecido"}` }, { status: 500 });
  }
}
