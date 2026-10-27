import { NextRequest, NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/dal";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { baixarDanfePdf, buscarEntregas, mensagemDeErro } from "@/lib/odoo/logistica";
import { pedidoIdOdoo } from "@/lib/odooExpedicaoSync";
import { nomePedidoOdoo } from "@/lib/pedidoOdoo";

// DANFE do cliente pro SAC imprimir -- Victor 26/10/2026. Pedido do Odoo pelo
// nome (S01589 / ODOO-S01589); o id vem de odoo_expedicao. ?doc=5922 (venda,
// padrão) ou 5117 (entrega). Nota emitida no Protheus a ponte não tem.

function aviso(titulo: string, texto: string, status: number) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#222;background:#fff">
<h1 style="font-size:20px">${titulo}</h1><p style="line-height:1.5">${texto}</p>
<p><a href="javascript:history.back()">Voltar</a></p></body>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(req: NextRequest, ctx: { params: Promise<{ pedido: string }> }) {
  const profile = await getOptionalProfile();
  const pode = (profile && ["sac", "assistencia", "admin"].includes(profile.role)) || (await getOperadorLogistica());
  if (!pode) return aviso("Sessão expirada", "Entre de novo no sistema e tente outra vez.", 401);

  const { pedido } = await ctx.params;
  const doc = req.nextUrl.searchParams.get("doc") === "5117" ? "5117" : "5922";
  const nome = nomePedidoOdoo(decodeURIComponent(pedido));
  if (!nome) {
    return aviso("Nota do Protheus", "Este pedido é do Protheus. A impressão das notas do Protheus ainda está sendo liberada.", 404);
  }
  // Pedido que ainda não passou pela leitura da expedição: o id vem da busca do Odoo.
  const id = (await pedidoIdOdoo(nome)) ?? (await buscarEntregas(nome).catch(() => [])).find((i) => i.pedido === nome)?.pedido_id ?? null;
  if (!id) {
    return aviso(
      "Pedido ainda não localizado",
      `O pedido ${escapar(nome)} não foi encontrado no Odoo agora. Confira o número ou tente de novo em instantes.`,
      404
    );
  }
  try {
    const { bytes, nome: arquivo } = await baixarDanfePdf(id, doc, "logistica");
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${arquivo}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = mensagemDeErro(err);
    if (/não tem a 5(922|117)/.test(msg)) {
      return aviso(
        doc === "5922" ? "Nota de venda não emitida no Odoo" : "Nota de entrega ainda não emitida",
        doc === "5922"
          ? `A nota de venda do pedido ${escapar(nome)} foi emitida no Protheus (venda de antes de 25/10). A impressão das notas do Protheus ainda está sendo liberada.`
          : `O pedido ${escapar(nome)} ainda não tem a nota de entrega (5117): ela sai quando a carga sai em rota.`,
        404
      );
    }
    return aviso("Odoo não respondeu", `Não consegui buscar a nota agora (${escapar(msg)}). Tente de novo em instantes.`, 502);
  }
}
