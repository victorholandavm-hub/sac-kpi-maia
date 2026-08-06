import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDriverSession } from "@/app/assistencia/driver-actions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saveRequestPhoto } from "@/lib/servicePhotos";

// Mesmo motivo de /api/montador/upload-photo: motorista também costuma abrir
// o link de dentro do navegador embutido do WhatsApp, que tem bug conhecido
// nesse app com o tipo de resposta em stream que Server Actions usam --
// POST comum com resposta JSON simples é bem mais compatível.
export async function POST(req: NextRequest) {
  const driverName = await getDriverSession();
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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  revalidatePath("/assistencia/motorista");
  return NextResponse.json({ ok: true });
}
