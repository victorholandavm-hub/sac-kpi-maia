import { NextRequest, NextResponse } from "next/server";
import { verifyClientRatingAccess } from "@/app/assistencia/avaliar/actions";

// Rota de API tradicional em vez de Server Action chamada direto -- o
// cliente abre esse link quase sempre escaneando o QR de dentro de um
// navegador embutido (câmera do celular, WhatsApp), com o mesmo bug já
// documentado pro upload de foto de montador/motorista (ver
// /api/montador/upload-photo/route.ts): Server Actions dependem de
// resposta RSC em stream, que esses navegadores restritos não suportam
// bem -- o clique simplesmente não fazia nada, sem erro nenhum visível.
export async function POST(req: NextRequest) {
  try {
    let body: { requestId?: unknown; cpf?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 400 });
    }

    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const cpf = typeof body.cpf === "string" ? body.cpf : "";
    if (!requestId) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 400 });

    const access = await verifyClientRatingAccess(requestId, cpf);
    return NextResponse.json(access);
  } catch (err) {
    console.error("[avaliar-verify] erro não previsto", err);
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 500 });
  }
}
