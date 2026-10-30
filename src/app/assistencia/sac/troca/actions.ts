"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { listarEmpresas, mensagemDeErro } from "@/lib/odoo/logistica";
import {
  AUTORIZADOR_TROCA_SAC,
  MODOS_TROCA,
  MOTIVOS_TROCA,
  buscarProdutos,
  executarTroca,
  previaTroca,
  totalNovos,
  trazerVendaProtheus,
  type PedidoTroca,
  type PreviaTroca,
  type ProdutoOdoo,
} from "@/lib/odoo/trocaSac";

// Troca de produto na nota pelo SAC -- Victor 30/10/2026: o SAC/assistência
// monta e pede, só o Victor autoriza; a ponte faz a troca ao autorizar.

type Resp<T> = { ok: true; dados: T } | { ok: false; erro: string };

async function quemPede() {
  const profile = await getProfile();
  if (!["sac", "assistencia", "admin"].includes(profile.role)) throw new Error("Sem permissão para trocar produto.");
  return profile;
}

export async function buscarProdutosTrocaAction(q: string): Promise<Resp<ProdutoOdoo[]>> {
  try {
    await quemPede();
    if (q.trim().length < 2) return { ok: true, dados: [] };
    return { ok: true, dados: (await buscarProdutos(q.trim())).slice(0, 30) };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function previaTrocaAction(pedidoId: number, itens: { codigo: string; qtd: number }[]): Promise<Resp<PreviaTroca>> {
  try {
    await quemPede();
    if (!itens.length) return { ok: false, erro: "Marque o que volta." };
    return { ok: true, dados: await previaTroca(pedidoId, itens) };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

// Venda do Protheus que ainda não está no Odoo: a ponte cria o pedido "legado"
// (já entregue, com as notas antigas) pra poder trocar.
export async function trazerVendaProtheusAction(filial: string, cpf: string, chave: string): Promise<Resp<{ pedidoId: number; pedido: string }>> {
  try {
    await quemPede();
    const empresa = (await listarEmpresas()).find((e) => e.name.startsWith(`${filial} `) || e.name.startsWith(filial));
    if (!empresa) return { ok: false, erro: `Loja ${filial} não encontrada no Odoo.` };
    const r = await trazerVendaProtheus(empresa.id, cpf.replace(/\D/g, ""), chave.replace(/\D/g, ""));
    return { ok: true, dados: { pedidoId: r.pedido_id, pedido: r.pedido } };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function pedirTrocaAction(input: { pedido: string; pedidoId: number; cliente: string | null; chamado: string; troca: PedidoTroca }): Promise<Resp<{ id: string }>> {
  try {
    const profile = await quemPede();
    const t = input.troca;
    const chamado = input.chamado.trim();
    if (!chamado) return { ok: false, erro: "Informe o número do chamado." };
    if (!t.itens.some((i) => i.qtd > 0)) return { ok: false, erro: "Marque o que volta." };
    if (!t.novos.length || t.novos.some((n) => !n.codigo || !(n.qtd > 0))) return { ok: false, erro: "Escolha o produto novo e a quantidade." };
    if (!MOTIVOS_TROCA.some((m) => m.codigo === t.motivo)) return { ok: false, erro: "Escolha o motivo." };
    if (!MODOS_TROCA.some((m) => m.codigo === t.modo)) return { ok: false, erro: "Escolha como o produto novo sai." };
    if (t.modo === "retira_depois" && !/^\d{3}$/.test(t.filial_retirada ?? "")) return { ok: false, erro: "Informe a loja onde o cliente retira." };
    if (!t.justificativa.trim()) return { ok: false, erro: "Escreva a justificativa." };
    const itens = t.itens.filter((i) => i.qtd > 0);
    const previa = await previaTroca(input.pedidoId, itens);
    const { data, error } = await getSupabaseAdmin()
      .from("trocas_sac")
      .insert({
        pedido: input.pedido,
        pedido_id: input.pedidoId,
        cliente: input.cliente ?? previa.cliente,
        chamado,
        solicitado_por: profile.fullName,
        pedido_troca: { ...t, itens: previa.itens.map((i) => ({ codigo: i.codigo, qtd: i.qtd, descricao: i.descricao, preco: i.preco })) },
        valor_credito: previa.valor,
        total_novo: totalNovos(t.novos),
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, erro: error?.message ?? "Não consegui registrar o pedido de troca." };
    revalidatePath("/assistencia/sac/trocas");
    return { ok: true, dados: { id: data.id as string } };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

type TrocaRow = { id: string; pedido: string; pedido_id: number; chamado: string; solicitado_por: string; pedido_troca: PedidoTroca; valor_credito: number | null; total_novo: number | null; status: string };

export async function decidirTrocaAction(id: string, aprovar: boolean, motivoRecusa?: string): Promise<Resp<{ status: string; mensagem: string }>> {
  try {
    const profile = await getProfile();
    if (profile.id !== AUTORIZADOR_TROCA_SAC) return { ok: false, erro: "Só o Victor autoriza troca pelo SAC." };
    const admin = getSupabaseAdmin();
    const { data: t } = await admin.from("trocas_sac").select("id, pedido, pedido_id, chamado, solicitado_por, pedido_troca, valor_credito, total_novo, status").eq("id", id).single<TrocaRow>();
    if (!t) return { ok: false, erro: "Pedido de troca não encontrado." };
    // Uma vez só: repetir depois de erro/parcial poderia gerar um segundo crédito -- aí é com o TI.
    if (t.status !== "pendente") return { ok: false, erro: `Esta troca já está ${t.status}.` };
    const agora = new Date().toISOString();
    if (!aprovar) {
      await admin.from("trocas_sac").update({ status: "recusada", decidido_por: profile.fullName, decidido_em: agora, motivo_recusa: motivoRecusa?.trim() || null }).eq("id", id);
      revalidatePath("/assistencia/sac/trocas");
      return { ok: true, dados: { status: "recusada", mensagem: "Troca recusada." } };
    }
    const diferenca = Math.max(0, Math.round(((t.total_novo ?? 0) - (t.valor_credito ?? 0)) * 100) / 100);
    let r;
    try {
      r = await executarTroca(t.pedido_id, t.pedido_troca, { autorizadoPor: profile.fullName, chamado: t.chamado, operador: `SAC ${t.solicitado_por}`, diferencaPix: diferenca });
    } catch (err) {
      await admin.from("trocas_sac").update({ status: "erro", decidido_por: profile.fullName, decidido_em: agora, erro: mensagemDeErro(err) }).eq("id", id);
      revalidatePath("/assistencia/sac/trocas");
      return { ok: false, erro: mensagemDeErro(err) };
    }
    const status = r.ok && !r.parcial && !r.erro ? "executada" : r.parcial || r.credito ? "parcial" : "erro";
    await admin.from("trocas_sac").update({ status, decidido_por: profile.fullName, decidido_em: agora, resultado: r, erro: r.erro ?? null }).eq("id", id);
    revalidatePath("/assistencia/sac/trocas");
    const mensagem =
      status === "executada"
        ? `Troca feita: crédito ${r.credito ?? ""} (nota ${r.nf_troca ?? r.numero ?? ""}), pedido novo ${r.pedido_novo ?? ""}.`
        : r.erro || "A ponte não confirmou a troca.";
    return status === "erro" ? { ok: false, erro: mensagem } : { ok: true, dados: { status, mensagem } };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}
