import { NextRequest, NextResponse } from "next/server";
import { baixarCcePdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";

// 27/10: PDF da Carta de Correção (CC-e) — ?chave=&seq=
export async function GET(req: NextRequest) {
  const op = await getOperadorLogistica();
  if (!op) return NextResponse.json({ error: "Sessão do CD expirada." }, { status: 401 });
  const chave = (req.nextUrl.searchParams.get("chave") ?? "").replace(/\D/g, "");
  const seq = req.nextUrl.searchParams.get("seq") ?? "";
  try {
    const { bytes, nome } = await baixarCcePdf(chave, seq);
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: mensagemDeErro(err) }, { status: 502 });
  }
}
