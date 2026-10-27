"use server";

// 27/10 (Eduardo/CD): Carta de Correção (CC-e) pela tela do CD.
import { enviarCce, lerCce, mensagemDeErro, type CartaCorrecao, type NotaCce } from "@/lib/odoo/logistica";
import { exigirOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import type { ResultadoAcao } from "@/lib/odoo/logisticaTipos";

export async function lerCceAction(q: { chave?: string; numero?: string; company_id?: number }): Promise<ResultadoAcao<NotaCce>> {
  try {
    await exigirOperadorLogistica();
    const chave = String(q.chave ?? "").replace(/\D/g, "");
    if (!chave && !(q.numero && q.company_id)) return { ok: false, erro: "Cole a chave (44 números) ou informe o número e a loja." };
    return { ok: true, dados: await lerCce({ chave: chave || undefined, numero: q.numero, company_id: q.company_id }) };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function enviarCceAction(chave: string, texto: string): Promise<ResultadoAcao<{ carta: CartaCorrecao; cartas: CartaCorrecao[] }>> {
  try {
    const op = await exigirOperadorLogistica();
    const t = String(texto ?? "").trim();
    if (t.length < 15) return { ok: false, erro: "Escreva pelo menos 15 caracteres." };
    if (t.length > 1000) return { ok: false, erro: "Máximo de 1000 caracteres." };
    return { ok: true, dados: await enviarCce(String(chave).replace(/\D/g, ""), t, op.operadorOdoo) };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}
