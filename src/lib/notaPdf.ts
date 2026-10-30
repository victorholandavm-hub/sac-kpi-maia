import { baixarDanfeChavePdf, mensagemDeErro } from "@/lib/odoo/logistica";
import { xmlDaNota } from "@/lib/copiaXmlNotas";
import { gerarDanfe, lerNfe } from "@/lib/danfe";

// PDF da nota pela chave: o DANFE da ponte; a 5922 (que a ponte não imprime)
// sai gerada do XML autorizado (danfe.ts). Usado pela rota nota-chave e pela
// nota automática da notificação de assistência (Victor 30/10/2026).
export async function pdfDaNotaPorChave(chave: string): Promise<{ bytes: Uint8Array; nome: string }> {
  try {
    const { bytes, nome } = await baixarDanfeChavePdf(chave, "logistica");
    return { bytes: new Uint8Array(bytes), nome };
  } catch (err) {
    if (!/5922|não é impressa/i.test(mensagemDeErro(err))) throw err;
    const nota = lerNfe(await xmlDaNota(chave));
    return { bytes: new Uint8Array(gerarDanfe(nota)), nome: `NF${nota.numero}-${chave.slice(-6)}.pdf` };
  }
}
