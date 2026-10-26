"use server";

// Verbos do operador do CD sobre o Odoo (motor). Cada action: confere a
// sessão (CD por PIN ou equipe admin/assistência), chama a ponte com o
// nome do operador (fica no histórico do Odoo) e devolve o resultado como
// dado -- ver ResultadoAcao em logisticaTipos.ts.

import { revalidatePath } from "next/cache";
import {
  acaoEntrega,
  acaoExtraCarga,
  estornarEntrega,
  executarAcaoCarga,
  historicoEntrega,
  listarDanfesCarga,
  mensagemDeErro,
  montarCarga,
  reordenarParadas,
  atenderSolicitacaoAbast,
  cancelarSolicitacaoAbast,
  darEntradaCompra,
  mudarPrevisaoCompra,
  cancelarPedidoCompra,
  buscarFornecedores,
  criarPedidoCompra,
} from "@/lib/odoo/logistica";
import type { EntradaCompraResposta, FornecedorOdoo, PedidoCompra, ItemInventarioSaldo, ItemInventarioAjuste } from "@/lib/odoo/logistica";
import { inventarioAplicar, inventarioSaldo } from "@/lib/odoo/logistica";
import { exigirOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import type {
  AcaoCarga,
  AcaoCargaResposta,
  AcaoEntrega,
  CargaDetalhe,
  DanfeCarga,
  EntregaOdoo,
  HistoricoEntrega,
  MontarCargaInput,
  ResultadoAcao,
  AtenderAbastResposta,
} from "@/lib/odoo/logisticaTipos";

const BASE = "/assistencia/logistica";

async function executar<T>(fn: (operador: string) => Promise<T>, revalidar: string[] = []): Promise<ResultadoAcao<T>> {
  try {
    const op = await exigirOperadorLogistica();
    const dados = await fn(op.operadorOdoo);
    for (const p of revalidar) revalidatePath(p);
    return { ok: true, dados };
  } catch (err) {
    console.error("[logistica-odoo]", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

const ACOES_CARGA: AcaoCarga[] = ["separacao", "conferir", "liberar", "sair", "finalizar"];

export async function montarCargaAction(input: Omit<MontarCargaInput, "operador">): Promise<ResultadoAcao<CargaDetalhe>> {
  return executar((operador) => montarCarga({ ...input, operador }), [`${BASE}/expedicao`, `${BASE}/cargas`]);
}

// 26/10 (Jhon): além de "Montar carga", incluir as saídas marcadas numa carga que ainda não saiu
export async function incluirNaCargaAction(cargaId: number, pickingIds: number[]): Promise<ResultadoAcao<CargaDetalhe>> {
  if (!(cargaId > 0)) return { ok: false, erro: "Escolha a carga." };
  if (!pickingIds.length) return { ok: false, erro: "Marque pelo menos uma saída." };
  return executar((operador) => acaoExtraCarga(cargaId, "adicionar", pickingIds, operador) as Promise<CargaDetalhe>, [`${BASE}/expedicao`, `${BASE}/cargas`, `${BASE}/cargas/${cargaId}`]);
}

export async function acaoCargaAction(
  cargaId: number,
  acao: AcaoCarga,
  extra: { motorista_id?: number | null; veiculo_id?: number | null; parciais?: Record<string, { codigo: string; qtd: number }[]> | null } = {},
): Promise<ResultadoAcao<AcaoCargaResposta>> {
  if (!ACOES_CARGA.includes(acao)) return { ok: false, erro: `Ação inválida: ${acao}` };
  return executar(
    (operador) => executarAcaoCarga(cargaId, acao, { operador, motorista_id: extra.motorista_id, veiculo_id: extra.veiculo_id, parciais: extra.parciais ?? null }),
    [`${BASE}/cargas`, `${BASE}/cargas/${cargaId}`],
  );
}

export async function reordenarParadasAction(cargaId: number, paradaIds: number[]): Promise<ResultadoAcao<CargaDetalhe>> {
  return executar(() => reordenarParadas(cargaId, paradaIds), [`${BASE}/cargas/${cargaId}`]);
}

export async function editarCargaAction(
  cargaId: number,
  campo: "programar" | "descricao" | "transportadora" | "motorista",
  valor: string,
): Promise<ResultadoAcao<unknown>> {
  if (campo === "programar" && valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { ok: false, erro: "Data no formato AAAA-MM-DD." };
  return executar((operador) => acaoExtraCarga(cargaId, campo, valor || null, operador), [`${BASE}/cargas/${cargaId}`, `${BASE}/cargas`]);
}

export async function excluirCargaAction(cargaId: number): Promise<ResultadoAcao<unknown>> {
  return executar((operador) => acaoExtraCarga(cargaId, "excluir", null, operador), [`${BASE}/cargas`, `${BASE}/expedicao`]);
}

// Baixa manual pelo CD (o Protheus chama de "Baixar Entrega"): parada vira
// "entregue" com origem odoo, sem geo/foto.
export async function baixarEntregaManualAction(cargaId: number, paradaId: number): Promise<ResultadoAcao<unknown>> {
  return executar((operador) => acaoExtraCarga(cargaId, "baixar_entrega", paradaId, operador), [`${BASE}/cargas/${cargaId}`]);
}

export async function listarDanfesAction(cargaId: number): Promise<ResultadoAcao<DanfeCarga[]>> {
  return executar(() => listarDanfesCarga(cargaId));
}

type AcaoEntregaSimples = Exclude<AcaoEntrega, "historico" | "estornar">;
const ACOES_ENTREGA: AcaoEntregaSimples[] = ["pendencia", "fila", "transferir_filial", "programar", "anotar", "remover_da_carga", "mover_carga"];

export async function acaoEntregaAction(
  pickingId: number,
  acao: AcaoEntregaSimples,
  valor: string | number | null,
  cargaId?: number,
): Promise<ResultadoAcao<EntregaOdoo>> {
  if (!ACOES_ENTREGA.includes(acao)) return { ok: false, erro: `Ação inválida: ${acao}` };
  if ((acao === "pendencia" || acao === "anotar") && !String(valor ?? "").trim()) return { ok: false, erro: "Escreva o texto." };
  if (acao === "programar" && !/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ""))) return { ok: false, erro: "Data no formato AAAA-MM-DD." };
  if (acao === "transferir_filial" && !(Number(valor) > 0)) return { ok: false, erro: "Escolha a filial." };
  if (acao === "mover_carga" && !(Number(valor) > 0)) return { ok: false, erro: "Escolha a carga de destino." };
  const revalidar = [`${BASE}/expedicao`];
  if (cargaId) revalidar.push(`${BASE}/cargas/${cargaId}`);
  return executar((operador) => acaoEntrega(pickingId, acao, valor, operador), revalidar);
}

export async function estornarEntregaAction(pickingId: number): Promise<ResultadoAcao<{ estornada: string; retorno: string; nova: string }>> {
  return executar((operador) => estornarEntrega(pickingId, operador), [`${BASE}/expedicao`]);
}

export async function historicoEntregaAction(pickingId: number): Promise<ResultadoAcao<HistoricoEntrega>> {
  return executar((operador) => historicoEntrega(pickingId, operador));
}

// Pedido de abastecimento da loja: CD atende (NF 5152 CD -> loja) ou cancela.
export async function atenderAbastAction(id: number, itens: { codigo: string; qtd: number }[]): Promise<ResultadoAcao<AtenderAbastResposta>> {
  const lista = itens.filter((i) => i.codigo && Number(i.qtd) > 0).map((i) => ({ codigo: i.codigo, qtd: Number(i.qtd) }));
  if (!lista.length) return { ok: false, erro: "Nada para atender: as quantidades estão zeradas." };
  return executar((operador) => atenderSolicitacaoAbast(id, lista, operador), [`${BASE}/abastecimento`]);
}

export async function cancelarAbastAction(id: number, motivo: string): Promise<ResultadoAcao<unknown>> {
  if (!motivo.trim()) return { ok: false, erro: "Escreva o motivo do cancelamento." };
  return executar((operador) => cancelarSolicitacaoAbast(id, operador, motivo.trim()), [`${BASE}/abastecimento`]);
}

// Compras do CD: entrada da nota contra o pedido, previsão, pedido novo.
export async function entradaCompraAction(
  recebimentoId: number,
  input: { nf: string; serie: string; chave: string; itens: { codigo: string; qtd: number }[] },
): Promise<ResultadoAcao<EntradaCompraResposta>> {
  const itens = input.itens.filter((i) => Number(i.qtd) > 0);
  if (!input.nf.trim()) return { ok: false, erro: "Informe o número da nota fiscal do fornecedor." };
  if (!itens.length) return { ok: false, erro: "Informe quanto chegou de pelo menos um produto." };
  return executar((operador) => darEntradaCompra(recebimentoId, { ...input, itens }, operador), [`${BASE}/compras`]);
}

export async function previsaoCompraAction(id: number, data: string): Promise<ResultadoAcao<unknown>> {
  if (!data) return { ok: false, erro: "Escolha a nova data de chegada." };
  return executar((operador) => mudarPrevisaoCompra(id, data, operador), [`${BASE}/compras`]);
}

export async function cancelarCompraAction(id: number, motivo: string): Promise<ResultadoAcao<unknown>> {
  if (!motivo.trim()) return { ok: false, erro: "Escreva o motivo do cancelamento." };
  return executar((operador) => cancelarPedidoCompra(id, motivo.trim(), operador), [`${BASE}/compras`]);
}

export async function buscarFornecedoresAction(q: string): Promise<ResultadoAcao<FornecedorOdoo[]>> {
  if (q.trim().length < 2) return { ok: false, erro: "Digite pelo menos 2 letras do nome ou o CNPJ." };
  return executar(() => buscarFornecedores(q.trim()));
}

export async function criarCompraAction(input: {
  fornecedor_id: number; ref: string; obs: string; itens: { codigo: string; qtd: number; preco: number; previsao: string }[];
}): Promise<ResultadoAcao<{ pedido: PedidoCompra }>> {
  if (!input.fornecedor_id) return { ok: false, erro: "Escolha o fornecedor." };
  const itens = input.itens.filter((i) => i.codigo.trim());
  if (!itens.length) return { ok: false, erro: "Coloque pelo menos um produto." };
  return executar((operador) => criarPedidoCompra({ ...input, itens }, operador), [`${BASE}/compras`]);
}

// Inventário: consulta saldo de sistema e aplica a contagem (ajuste no Odoo).
export async function inventarioSaldoAction(companyId: number, codigos: string[]): Promise<ResultadoAcao<{ empresa: string; deposito: string; itens: ItemInventarioSaldo[] }>> {
  const lista = Array.from(new Set(codigos.map((c) => c.trim().toUpperCase()).filter(Boolean)));
  if (!lista.length) return { ok: false, erro: "Digite pelo menos um código." };
  return executar(() => inventarioSaldo(companyId, lista));
}
export async function inventarioAplicarAction(companyId: number, itens: { codigo: string; contado: number }[], motivo: string):
  Promise<ResultadoAcao<{ itens: ItemInventarioAjuste[]; erros: string[]; ajustados: number }>> {
  const lista = itens.filter((i) => i.codigo.trim() && Number.isFinite(i.contado) && i.contado >= 0);
  if (!lista.length) return { ok: false, erro: "Nenhuma contagem válida para aplicar." };
  return executar((operador) => inventarioAplicar(companyId, lista, operador, motivo.trim()), [`${BASE}/inventario`, `${BASE}/kardex`]);
}
