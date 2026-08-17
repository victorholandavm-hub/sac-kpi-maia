import { NextRequest, NextResponse } from "next/server";
import { submitClientRating } from "@/app/assistencia/avaliar/actions";

// Mesmo motivo de /api/avaliar/verify -- POST comum, não Server Action,
// pra funcionar no navegador embutido de dentro do qual o cliente
// normalmente abre esse link.
export async function POST(req: NextRequest) {
  try {
    let body: { requestId?: unknown; cpf?: unknown; deliveryRating?: unknown; resolutionRating?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o envio. Tente de novo." }, { status: 400 });
    }

    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const cpf = typeof body.cpf === "string" ? body.cpf : "";
    const deliveryRating = Number(body.deliveryRating);
    const resolutionRating = Number(body.resolutionRating);
    if (!requestId) return NextResponse.json({ error: "Chamado inválido." }, { status: 400 });

    await submitClientRating(requestId, cpf, deliveryRating, resolutionRating);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[avaliar-submit] erro", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro inesperado." }, { status: 500 });
  }
}
