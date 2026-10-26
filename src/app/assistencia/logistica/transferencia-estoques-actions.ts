"use server";

import { revalidatePath } from "next/cache";
import { exigirOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import {
  locaisEstoque,
  mensagemDeErro,
  saldoEstoqueTipo,
  transferirEstoques,
  type LocalEstoque,
  type SaldoEstoqueItem,
  type TipoEstoque,
  type TransferenciaEstoques,
} from "@/lib/odoo/logistica";
import type { ResultadoAcao } from "@/lib/odoo/logisticaTipos";

// Transferência entre estoques (26/10/2026, Pedro: rotina do Flávio/auditoria) -- estoque de venda <-> avaria <-> assistência,
// em qualquer loja e no CD. A ponte confere o saldo livre na origem e grava quem/motivo no histórico.

async function executar<T>(fn: (operador: string) => Promise<T>): Promise<ResultadoAcao<T>> {
  try {
    const op = await exigirOperadorLogistica();
    return { ok: true, dados: await fn(op.operadorOdoo) };
  } catch (err) {
    console.error("[transferencia-estoques]", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function locaisEstoqueAction(companyId: number): Promise<ResultadoAcao<{ locais: LocalEstoque[] }>> {
  if (!(companyId > 0)) return { ok: false, erro: "Escolha a loja ou o CD." };
  return executar(() => locaisEstoque(companyId));
}

export async function saldoEstoqueTipoAction(companyId: number, tipo: "avaria" | "assistencia"): Promise<ResultadoAcao<{ itens: SaldoEstoqueItem[]; pecas: number }>> {
  if (!(companyId > 0)) return { ok: false, erro: "Escolha a loja ou o CD." };
  return executar(() => saldoEstoqueTipo(companyId, tipo));
}

export async function transferirEstoquesAction(input: {
  company_id: number; origem: TipoEstoque; destino: TipoEstoque; itens: { codigo: string; qtd: number }[]; motivo: string;
}): Promise<ResultadoAcao<TransferenciaEstoques>> {
  if (!(input.company_id > 0)) return { ok: false, erro: "Escolha a loja ou o CD." };
  if (input.origem === input.destino) return { ok: false, erro: "Origem e destino são o mesmo estoque." };
  const itens = input.itens.filter((i) => i.codigo.trim() && Number(i.qtd) > 0).map((i) => ({ codigo: i.codigo.trim().toUpperCase(), qtd: Number(i.qtd) }));
  if (!itens.length) return { ok: false, erro: "Informe pelo menos um produto com quantidade." };
  if (input.motivo.trim().length < 3) return { ok: false, erro: "Informe o motivo." };
  const r = await executar((operador) => transferirEstoques({ ...input, itens, motivo: input.motivo.trim() }, operador));
  if (r.ok) revalidatePath("/assistencia/logistica/inventario");
  return r;
}
