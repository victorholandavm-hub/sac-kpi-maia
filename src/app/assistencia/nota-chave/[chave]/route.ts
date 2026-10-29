import { NextRequest, NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/dal";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { baixarDanfeChavePdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { xmlDaNota } from "@/lib/copiaXmlNotas";
import { gerarDanfe, lerNfe } from "@/lib/danfe";

// DANFE de qualquer nota pela chave de acesso -- Victor 27/10/2026. A ponte do
// Pedro gera pelo XML guardado (SPED050/054 do Protheus e as do Odoo), então
// serve a nota de VENDA antiga do Protheus, que a API do Protheus não dava.

function aviso(titulo: string, texto: string, status: number) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#222;background:#fff">
<h1 style="font-size:20px">${titulo}</h1><p style="line-height:1.5">${texto}</p>
<p><a href="javascript:history.back()">Voltar</a></p></body>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Nota de venda (5922): a ponte recusa ("a nota que acompanha a mercadoria é
// a 5117"); a 2ª via sai daqui, do XML autorizado -- Victor 29/10/2026.
// ?xml=1 devolve o próprio XML.
async function danfeDoXml(chave: string) {
  const xml = await xmlDaNota(chave);
  const nota = lerNfe(xml);
  return new NextResponse(new Uint8Array(gerarDanfe(nota)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="NF${nota.numero}-${chave.slice(-6)}.pdf"`, "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const profile = await getOptionalProfile();
  const pode = (profile && ["sac", "assistencia", "admin"].includes(profile.role)) || (await getOperadorLogistica());
  if (!pode) return aviso("Sessão expirada", "Entre de novo no sistema e tente outra vez.", 401);
  const chave = (await ctx.params).chave.replace(/\D/g, "");
  if (chave.length !== 44) return aviso("Chave inválida", "A chave de acesso tem 44 dígitos.", 400);
  if (req.nextUrl.searchParams.get("xml") === "1") {
    try {
      return new NextResponse(await xmlDaNota(chave), {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${chave}.xml"`, "Cache-Control": "no-store" },
      });
    } catch (err) {
      return aviso("XML não encontrado", `Não consegui o XML da nota (${escapar(mensagemDeErro(err))}).`, 502);
    }
  }
  try {
    const { bytes, nome } = await baixarDanfeChavePdf(chave, "logistica");
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = mensagemDeErro(err);
    if (/5922|não é impressa/i.test(msg)) {
      try {
        return await danfeDoXml(chave);
      } catch (e) {
        return aviso("Não consegui gerar a nota", `${escapar(mensagemDeErro(e))}. Tente de novo em instantes.`, 502);
      }
    }
    if (/não encontrad/i.test(msg)) return aviso("Nota não encontrada", `A nota de chave ${chave} não está no Protheus nem no Odoo.`, 404);
    return aviso("Não consegui gerar a nota", `${escapar(msg)}. Tente de novo em instantes.`, 502);
  }
}
