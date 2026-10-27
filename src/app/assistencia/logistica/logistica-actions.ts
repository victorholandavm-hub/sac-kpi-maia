"use server";

// Verbos do operador do CD sobre o Odoo (motor). Cada action: confere a
// sessão (CD por PIN ou equipe admin/assistência), chama a ponte com o
// nome do operador (fica no histórico do Odoo) e devolve o resultado como
// dado -- ver ResultadoAcao em logisticaTipos.ts.

import { revalidatePath } from "next/cache";
import { limparCacheExpedicao } from "@/lib/odoo/logistica";
import {
  acaoEntrega,
  lerItensEntrega,
  separarPendencia,
  type ItemEntregaOdoo,
  acaoExtraCarga,
  audAgrupado,
  audGeral,
  audPedidos,
  audRotatividade,
  type AudFiltro2,
  type AudGeralItem,
  type AudGrupoLinha,
  type AudRotLista,
  audPosicao,
  audReservas,
  audSefaz,
  type AudFiltro,
  type AudLista,
  type AudPedidoItem,
  type AudPosicaoItem,
  type AudReservaItem,
  type AudSefazItem,
  listarManifesto,
  notasDaCarga,
  acaoMdfe,
  progressoCarga,
  type ProgressoCarga,
  type CargaManifesto,
  type NotaCarga,
  type MdfeCarga,
  alterarProdutoCadastro,
  buscarProdutosCadastro,
  darEntradaSemPedidoCd,
  lerNfCdPorChave,
  lerNfCdPorXml,
  type EntradaSemPedidoResposta,
  type NfFornecedor,
  lojasProdutoCadastro,
  type EstoqueLoja,
  criarProdutoCadastro,
  type ProdutoCadastro,
  buscarEntregas,
  historicoCliente,
  type HistCliente,
  type BuscaEntrega,
  buscarNfChave,
  type NfChave,
  type ParcelaPagar,
  lerCarga,
  registrarParadaPeloCd,
  estornarEntrega,
  executarAcaoCarga,
  historicoEntrega,
  listarDanfesCarga,
  mensagemDeErro,
  montarCarga,
  reordenarParadas,
  atenderSolicitacaoAbast,
  cancelarSolicitacaoAbast,
  novoPedidoAbast,
  darEntradaCompra,
  mudarPrevisaoCompra,
  cancelarPedidoCompra,
  buscarFornecedores,
  criarPedidoCompra,
} from "@/lib/odoo/logistica";
import type { EntradaCompraResposta, FornecedorOdoo, PedidoCompra, ItemInventarioSaldo, ItemInventarioAjuste } from "@/lib/odoo/logistica";
import { inventarioAplicar, inventarioSaldo } from "@/lib/odoo/logistica";
import { exigirOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
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
    limparCacheExpedicao();
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

// 26/10 (Pedro): cliente mandou fretista RETIRAR no CD. Faz o caminho já testado de uma carga, numa carga só dela:
// monta (tipo retira agendada, motorista/veículo "RETIRADA NO CD") -> separação -> conferida -> liberada -> SAIR (emite a 5117)
// -> baixa "entregue" com quem retirou na observação -> fim. Ids criados no Odoo em 26/10 (maia16).
const RETIRA_CD = { motorista_id: 51, veiculo_id: 35, zona_id: 21 };
export async function retiradaNoCdAction(companyId: number, pickingId: number, quem: string): Promise<ResultadoAcao<{ romaneio: string; carga_id: number; notas: string[] }>> {
  const q = String(quem || "").trim();
  if (q.length < 3) return { ok: false, erro: "Escreva quem retirou (nome, documento e placa do fretista)." };
  return executar(
    async (operador) => {
      const c = await montarCarga({
        company_id: companyId, picking_ids: [pickingId], tipo: "retira_agendada", ...RETIRA_CD,
        descricao: `RETIRADA NO CD · ${q}`.slice(0, 100), operador,
      });
      for (const a of ["separacao", "conferir", "liberar"] as const) await executarAcaoCarga(c.carga_id, a, { operador });
      const r = await executarAcaoCarga(c.carga_id, "sair", { operador });
      const d = await lerCarga(c.carga_id);
      for (const p of d.paradas) {
        await registrarParadaPeloCd(p.parada_id, { resultado: "entregue", obs: `Retirado no CD por ${q} (liberado por ${operador})`.slice(0, 500) });
      }
      await executarAcaoCarga(c.carga_id, "finalizar", { operador });
      const notas = ((r as { notas?: { pedido: string; nf5117: string | null }[] }).notas ?? []).map((n) => `${n.pedido}: 5117 nº ${n.nf5117 ?? "?"}`);
      return { romaneio: c.romaneio, carga_id: c.carga_id, notas };
    },
    [`${BASE}/expedicao`, `${BASE}/cargas`],
  );
}

export async function acaoCargaAction(
  cargaId: number,
  acao: AcaoCarga,
  extra: { motorista_id?: number | null; veiculo_id?: number | null; parciais?: Record<string, { codigo: string; qtd: number }[]> | null } = {},
): Promise<ResultadoAcao<AcaoCargaResposta>> {
  if (!ACOES_CARGA.includes(acao)) return { ok: false, erro: `Ação inválida: ${acao}` };
  return executar(
    async (operador) => {
      const r = await executarAcaoCarga(cargaId, acao, { operador, motorista_id: extra.motorista_id, veiculo_id: extra.veiculo_id, parciais: extra.parciais ?? null });
      await registrarAcaoCarga(cargaId, r?.romaneio ?? null, acao, r?.estado ?? null, operador);
      return r;
    },
    [`${BASE}/cargas`, `${BASE}/cargas/${cargaId}`],
  );
}

// 26/10 (Victor: "quem conferiu" nos eventos da carga): grava quem fez cada passo (tabela odoo_carga_acoes, 0206).
// Nunca derruba a ação: o Odoo já aceitou; se o banco falhar, só fica no log.
async function registrarAcaoCarga(cargaId: number, romaneio: string | null, acao: string, estado: string | null, operador: string) {
  try {
    const { error } = await getSupabaseAdmin().from("odoo_carga_acoes").insert({ carga_id: cargaId, romaneio, acao, estado, operador });
    if (error) console.error("[logistica-odoo] registrar ação da carga", cargaId, acao, error.message);
  } catch (err) {
    console.error("[logistica-odoo] registrar ação da carga", cargaId, acao, err);
  }
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

// 26/10 (Pedro): pedido posto em rota por engano -> "não saiu": registra não entregue com o motivo nao_saiu_cd;
// o Odoo devolve o pedido para a fila do CD (mesmo caminho do "não entregue" do motorista). A carga segue.
export async function naoSaiuAction(cargaId: number, paradaId: number, obs: string): Promise<ResultadoAcao<unknown>> {
  return executar(
    (operador) => registrarParadaPeloCd(paradaId, { resultado: "insucesso", motivo: "nao_saiu_cd", obs: `Não saiu do CD (${operador}): ${obs || "carregado por engano"}`.slice(0, 500) }),
    [`${BASE}/cargas/${cargaId}`, `${BASE}/expedicao`],
  );
}

export async function historicoClienteAction(q: string): Promise<ResultadoAcao<HistCliente[]>> {
  if (String(q || "").trim().length < 3) return { ok: true, dados: [] } as ResultadoAcao<HistCliente[]>;
  return executar(() => historicoCliente(q.trim()));
}

export async function buscarEntregasAction(q: string): Promise<ResultadoAcao<BuscaEntrega[]>> {
  if (String(q || "").trim().length < 3) return { ok: true, dados: [] } as ResultadoAcao<BuscaEntrega[]>;
  return executar(() => buscarEntregas(q.trim()));
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

export async function itensEntregaAction(pickingId: number): Promise<ResultadoAcao<ItemEntregaOdoo[]>> {
  return executar(() => lerItensEntrega(pickingId));
}

export async function separarPendenciaAction(pickingId: number, motivo: string, codigos: string[], cargaId?: number): Promise<ResultadoAcao<{ pendencia: string; itens: string }>> {
  if (!String(motivo || "").trim()) return { ok: false, erro: "Escreva o motivo." };
  if (!codigos.length) return { ok: false, erro: "Marque o item que vai para a pendência." };
  const revalidar = [`${BASE}/expedicao`];
  if (cargaId) revalidar.push(`${BASE}/cargas/${cargaId}`);
  return executar((operador) => separarPendencia(pickingId, motivo.trim(), codigos, operador), revalidar);
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

export async function novoAbastAction(companyId: number, itens: { codigo: string; qtd: number }[], atender: boolean) {
  const lista = itens.filter((i) => i.codigo && Number(i.qtd) > 0).map((i) => ({ codigo: i.codigo, qtd: Number(i.qtd) }));
  if (!(companyId > 0)) return { ok: false as const, erro: "Escolha a loja." };
  if (!lista.length) return { ok: false as const, erro: "Coloque pelo menos um produto com quantidade." };
  return executar((operador) => novoPedidoAbast({ company_id_loja: companyId, itens: lista, atender }, operador), [`${BASE}/abastecimento`]);
}

export async function cancelarAbastAction(id: number, motivo: string): Promise<ResultadoAcao<unknown>> {
  if (!motivo.trim()) return { ok: false, erro: "Escreva o motivo do cancelamento." };
  return executar((operador) => cancelarSolicitacaoAbast(id, operador, motivo.trim()), [`${BASE}/abastecimento`]);
}

// Compras do CD: entrada da nota contra o pedido, previsão, pedido novo.
export async function entradaCompraAction(
  recebimentoId: number,
  input: { nf: string; serie: string; chave: string; itens: { codigo: string; qtd: number }[]; lancar_pagar?: boolean; emissao?: string; parcelas?: ParcelaPagar[] },
): Promise<ResultadoAcao<EntradaCompraResposta>> {
  if (input.lancar_pagar && input.parcelas?.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.venc) || !(Number(p.valor) > 0)))
    return { ok: false, erro: "Confira os boletos: cada um precisa de vencimento e valor." };
  const itens = input.itens.filter((i) => Number(i.qtd) > 0);
  if (!input.nf.trim()) return { ok: false, erro: "Informe o número da nota fiscal do fornecedor." };
  if (!itens.length) return { ok: false, erro: "Informe quanto chegou de pelo menos um produto." };
  return executar((operador) => darEntradaCompra(recebimentoId, { ...input, itens }, operador), [`${BASE}/compras`]);
}

export async function buscarNfChaveAction(chave: string): Promise<ResultadoAcao<NfChave>> {
  const c = String(chave || "").replace(/\D/g, "");
  if (c.length !== 44) return { ok: false, erro: "A chave tem 44 números." };
  return executar(() => buscarNfChave(c));
}

export async function lojasProdutoAction(id: number): Promise<ResultadoAcao<{ lojas: EstoqueLoja[]; total: number }>> {
  return executar(() => lojasProdutoCadastro(id));
}

export async function lerNfCdAction(chave: string): Promise<ResultadoAcao<NfFornecedor>> {
  const c = String(chave || "").replace(/\D/g, "");
  if (c.length !== 44) return { ok: false, erro: "A chave tem 44 números." };
  return executar(() => lerNfCdPorChave(c));
}
export async function lerNfCdXmlAction(xml: string): Promise<ResultadoAcao<NfFornecedor>> {
  if (!xml || xml.length < 200) return { ok: false, erro: "Arquivo XML inválido." };
  return executar(() => lerNfCdPorXml(xml));
}
export async function entradaSemPedidoAction(input: Parameters<typeof darEntradaSemPedidoCd>[0]): Promise<ResultadoAcao<EntradaSemPedidoResposta>> {
  if (!input.itens.length) return { ok: false, erro: "Nenhum item com quantidade." };
  if (input.itens.some((i) => !i.product_id && !i.codigo)) return { ok: false, erro: "Escolha o nosso produto para todos os itens." };
  if (input.lancar_pagar && input.parcelas.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.venc) || !(Number(p.valor) > 0)))
    return { ok: false, erro: "Confira os boletos: cada um precisa de vencimento e valor." };
  return executar((operador) => darEntradaSemPedidoCd(input, operador), [`${BASE}/compras`]);
}

export async function buscarProdutosAction(q: string): Promise<ResultadoAcao<ProdutoCadastro[]>> {
  if (String(q || "").trim().length < 2) return { ok: false, erro: "Digite pelo menos 2 letras ou o código." };
  return executar(() => buscarProdutosCadastro(q.trim()));
}
export async function criarProdutoAction(input: { codigo: string; nome: string; preco: number; ncm: string; ean?: string; custo?: number }): Promise<ResultadoAcao<{ produto: ProdutoCadastro }>> {
  if (!input.codigo.trim() || !input.nome.trim()) return { ok: false, erro: "Preencha código e nome." };
  if (!(Number(input.preco) > 0)) return { ok: false, erro: "Informe o preço de venda." };
  return executar((operador) => criarProdutoCadastro(input, operador));
}
export async function alterarProdutoAction(id: number, input: { preco?: number; nome?: string; ncm?: string; ean?: string; ativo?: boolean }): Promise<ResultadoAcao<{ produto: ProdutoCadastro; mudou?: string[]; aviso?: string }>> {
  return executar((operador) => alterarProdutoCadastro(id, input, operador));
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


// 26/10/2026 (Pedro): aba Manifesto — MDF-e da carga (transferência 5152 + notas dos clientes)
export async function listarManifestoAction(companyId: number): Promise<ResultadoAcao<CargaManifesto[]>> {
  return executar(() => listarManifesto(companyId));
}
export async function notasDaCargaAction(cargaId: number): Promise<ResultadoAcao<{ romaneio: string; notas: NotaCarga[]; mdfe: MdfeCarga; faltas: string[] }>> {
  return executar(() => notasDaCarga(cargaId));
}
export async function progressoCargaAction(cargaId: number): Promise<ResultadoAcao<ProgressoCarga>> {
  return executar(() => progressoCarga(cargaId));
}

export async function acaoMdfeAction(cargaId: number, acao: "emitir" | "encerrar" | "consultar"): Promise<ResultadoAcao<Record<string, unknown>>> {
  if (!["emitir", "encerrar", "consultar"].includes(acao)) return { ok: false, erro: "Ação inválida." };
  return executar((operador) => acaoMdfe(cargaId, acao, operador), [`${BASE}/manifesto`]);
}

// 26/10 (auditoria do CD — Flávio): aba Estoque (só leitura)
export async function audPosicaoAction(f: AudFiltro): Promise<ResultadoAcao<AudLista<AudPosicaoItem>>> {
  return executar(() => audPosicao(f));
}
export async function audReservasAction(f: AudFiltro): Promise<ResultadoAcao<AudLista<AudReservaItem>>> {
  return executar(() => audReservas(f));
}
export async function audSefazAction(f: AudFiltro): Promise<ResultadoAcao<AudLista<AudSefazItem>>> {
  return executar(() => audSefaz(f));
}
export async function audPedidosAction(f: AudFiltro): Promise<ResultadoAcao<AudLista<AudPedidoItem>>> {
  return executar(() => audPedidos(f));
}
export async function audGeralAction(f: AudFiltro2): Promise<ResultadoAcao<AudLista<AudGeralItem>>> {
  return executar(() => audGeral(f));
}
export async function audAgrupadoAction(f: AudFiltro2): Promise<ResultadoAcao<AudLista<AudGrupoLinha | AudGeralItem>>> {
  return executar(() => audAgrupado(f));
}
export async function audRotatividadeAction(f: AudFiltro2): Promise<ResultadoAcao<AudRotLista>> {
  return executar(() => audRotatividade(f));
}
