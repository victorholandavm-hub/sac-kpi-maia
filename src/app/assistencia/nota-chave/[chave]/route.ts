import { NextRequest, NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/dal";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { baixarDanfeChavePdf, mensagemDeErro } from "@/lib/odoo/logistica";

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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const profile = await getOptionalProfile();
  const pode = (profile && ["sac", "assistencia", "admin"].includes(profile.role)) || (await getOperadorLogistica());
  if (!pode) return aviso("Sessão expirada", "Entre de novo no sistema e tente outra vez.", 401);
  const chave = (await ctx.params).chave.replace(/\D/g, "");
  if (chave.length !== 44) return aviso("Chave inválida", "A chave de acesso tem 44 dígitos.", 400);
  try {
    const { bytes, nome } = await baixarDanfeChavePdf(chave, "logistica");
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = mensagemDeErro(err);
    if (/não encontrad/i.test(msg)) return aviso("Nota não encontrada", `A nota de chave ${chave} não está no Protheus nem no Odoo.`, 404);
    return aviso("Não consegui gerar a nota", `${escapar(msg)}. Tente de novo em instantes.`, 502);
  }
}
