"use server";

import { revalidatePath } from "next/cache";
import { exigirOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { emitirDevolucaoFornecedor, mensagemDeErro, notaEntradaDevolucao, type DevolucaoFornecedor, type NotaEntrada } from "@/lib/odoo/logistica";
import type { ResultadoAcao } from "@/lib/odoo/logisticaTipos";

// 27/10/2026 (Edu/CD; regras do Gabriel): devolução de compra ao fornecedor. A nota sai com o fornecedor da nota de entrada,
// uma refNFe por nota, ICMS na alíquota da entrada de cada item, PIS/COFINS CST 01 (base cheia) e IPI CST 53.

export async function notaEntradaAction(chave: string): Promise<ResultadoAcao<NotaEntrada>> {
  const c = String(chave || "").replace(/\D/g, "");
  if (c.length !== 44) return { ok: false, erro: "A chave da nota de entrada tem 44 números." };
  try {
    await exigirOperadorLogistica();
    return { ok: true, dados: await notaEntradaDevolucao(c) };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function emitirDevolucaoAction(input: {
  company_id: number; origem: string; fornecedor: string; motivo: string;
  itens: { codigo: string; qtd: number; preco: number; icms_percent: number; ipi_devol: number; chave_origem: string }[];
}): Promise<ResultadoAcao<DevolucaoFornecedor>> {
  if (!(input.company_id > 0)) return { ok: false, erro: "Escolha a loja ou o CD." };
  const itens = input.itens.filter((i) => Number(i.qtd) > 0);
  if (!itens.length) return { ok: false, erro: "Informe a quantidade de pelo menos um item." };
  if (input.motivo.trim().length < 3) return { ok: false, erro: "Informe o motivo da devolução." };
  try {
    const op = await exigirOperadorLogistica();
    const r = await emitirDevolucaoFornecedor({ ...input, itens, motivo: input.motivo.trim(), operador: op.operadorOdoo });
    revalidatePath("/assistencia/logistica/inventario");
    return { ok: true, dados: r };
  } catch (err) {
    console.error("[devolucao-fornecedor]", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}
