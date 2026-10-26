import { NextRequest, NextResponse } from "next/server";
import { baixarDanfeChavePdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";

// 26/10 (Eduardo): DANFE A4 da NF 5152 do abastecimento CD -> loja, pela chave (não tem pedido de venda).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const op = await getOperadorLogistica();
  if (!op) return NextResponse.json({ error: "Sessão do CD expirada." }, { status: 401 });
  const { chave } = await ctx.params;
  try {
    const { bytes, nome } = await baixarDanfeChavePdf(chave, "logistica");
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: mensagemDeErro(err) }, { status: 502 });
  }
}
