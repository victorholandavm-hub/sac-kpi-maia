import { NextRequest, NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/dal";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { lerPdfNota, notasEntregaDoPedido } from "@/lib/notaEntregaProtheus";

// Nota de entrega (5117) de um pedido do Protheus pro SAC imprimir -- Victor
// 27/10/2026. Usa a cópia guardada; se ainda não tem, busca no Protheus pelo
// CPF do cliente (totvs_deliveries) e guarda. ?chave= escolhe entre tentativas.

function aviso(titulo: string, texto: string, status: number) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#222;background:#fff">
<h1 style="font-size:20px">${titulo}</h1><p style="line-height:1.5">${texto}</p>
<p><a href="javascript:history.back()">Voltar</a></p></body>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ filial: string; pedido: string }> }) {
  const profile = await getOptionalProfile();
  const pode = (profile && ["sac", "assistencia", "admin"].includes(profile.role)) || (await getOperadorLogistica());
  if (!pode) return aviso("Sessão expirada", "Entre de novo no sistema e tente outra vez.", 401);

  const { filial, pedido } = await ctx.params;
  if (!/^\d{3}$/.test(filial) || !/^[A-Z0-9]{1,10}$/i.test(pedido)) return aviso("Pedido inválido", "Confira a filial e o número do pedido.", 400);
  const { data } = await getSupabaseAdmin().from("totvs_deliveries").select("client_cpf_cnpj").eq("pedido", pedido).eq("filial_venda", filial).limit(1);
  let notas;
  try {
    notas = await notasEntregaDoPedido(filial, pedido, data?.[0]?.client_cpf_cnpj ?? null);
  } catch (err) {
    return aviso("Protheus não respondeu", `Não consegui buscar a nota agora (${(err as Error).message}). Tente de novo em instantes.`, 502);
  }
  const escolhida = notas.find((n) => n.chave === req.nextUrl.searchParams.get("chave")) ?? notas.find((n) => n.tem_pdf) ?? notas[0];
  // Nota antiga copiada só com o XML: a DANFE sai pela ponte, pela chave.
  // Caminho relativo: atrás do nginx o req.url é o endereço interno.
  if (escolhida && !escolhida.tem_pdf) return new NextResponse(null, { status: 307, headers: { Location: `/assistencia/nota-chave/${escolhida.chave}` } });
  if (!escolhida) {
    return aviso("Nota de entrega não encontrada", `O pedido ${pedido} (filial ${filial}) não tem nota de entrega impressa no Protheus. A nota de venda do Protheus só tem a chave de acesso (aparece na consulta).`, 404);
  }
  try {
    const pdf = await lerPdfNota(escolhida.chave);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="NF${escolhida.nota ?? ""}-entrega-${pedido}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch {
    return aviso("Arquivo da nota não encontrado", "A nota está registrada mas o PDF não está no servidor. Avise o Victor.", 500);
  }
}
