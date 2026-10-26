import { NextRequest, NextResponse } from "next/server";
import { baixarDamdfePdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";

// 26/10: DAMDFE (impressão do manifesto) da carga.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ cargaId: string }> }) {
  const op = await getOperadorLogistica();
  if (!op) return NextResponse.json({ error: "Sessão do CD expirada." }, { status: 401 });
  const { cargaId } = await ctx.params;
  try {
    const { bytes, nome } = await baixarDamdfePdf(Number(cargaId));
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: mensagemDeErro(err) }, { status: 502 });
  }
}
