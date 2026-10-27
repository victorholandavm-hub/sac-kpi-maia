import { getSupabaseAdmin } from "./supabaseAdmin";
import { listNpsDetratores, NPS_DETRATOR_ORIGEM_LABELS, type NpsDetratorOrigem } from "./npsDetratores";
import { buscarClientePorCpf, buscarClientePorTelefone } from "./vouchers";
import { somenteDigitos, dataBr, type PreenchimentoVoucher } from "./vouchersCore";

// Atalhos "Emitir voucher" das linhas de estorno (/clientes) e de detrator
// (/avaliacoes): a URL leva só o id do caso (nunca CPF/telefone) e os dados
// são buscados aqui, no servidor, já com a sessão de admin conferida.

export async function preencherDeEstorno(id: string): Promise<PreenchimentoVoucher | null> {
  const admin = getSupabaseAdmin();
  if (id.startsWith("req-")) {
    const reqId = id.slice(4);
    const { data } = await admin
      .from("estorno_requests")
      .select("id, cliente_nome, cpf, motivo, nf_entrada, created_at, stores(name)")
      .eq("id", reqId)
      .maybeSingle();
    if (!data) return null;
    const loja = (data.stores as unknown as { name: string } | null)?.name;
    return completar({
      clienteNome: data.cliente_nome,
      clienteCpf: data.cpf ?? "",
      motivo: "outro",
      observacao: `Estorno pedido em ${dataBr(data.created_at)}${loja ? ` (${loja})` : ""}${data.motivo ? `: ${data.motivo}` : ""}`.slice(0, 300),
      pedidoOrigem: data.nf_entrada ? `NF ${data.nf_entrada}` : "",
      origem: "estorno_request",
      origemId: data.id,
    });
  }
  const { data } = await admin.from("estornos").select("id, cliente, cpf_cnpj, motivo, data_solicitacao, loja").eq("id", id).maybeSingle();
  if (!data) return null;
  return completar({
    clienteNome: data.cliente.replace(/\s*\([^)]*\)\s*$/, ""),
    clienteCpf: data.cpf_cnpj ?? "",
    motivo: "outro",
    observacao: `Estorno de ${dataBr(data.data_solicitacao)} (${data.loja})${data.motivo ? `: ${data.motivo}` : ""}`.slice(0, 300),
    origem: "estorno",
    origemId: data.id,
  });
}

export async function preencherDeNps(chave: string): Promise<PreenchimentoVoucher | null> {
  // Só no primeiro ":" -- o pós-venda do Odoo usa origemId "odoo:<pedido>".
  const i = chave.indexOf(":");
  const origem = i > 0 ? chave.slice(0, i) : "";
  const origemId = i > 0 ? chave.slice(i + 1) : "";
  if (!origem || !origemId) return null;
  const d = (await listNpsDetratores({ todoHistorico: true })).find((x) => x.origem === origem && x.origemId === origemId);
  if (!d) return null;
  const doCadastro = d.clientPhone ? await buscarClientePorTelefone(d.clientPhone) : null;
  const motivo = d.origem === "entrega" || d.origem === "compra" ? "atraso_entrega" : d.origem === "assistencia_tecnica" || d.origem === "montagem" ? "defeito_assistencia" : "outro";
  return {
    clienteNome: doCadastro?.nome ?? d.clientName ?? "",
    clienteCpf: doCadastro?.cpf ?? "",
    clienteTelefone: d.clientPhone ?? doCadastro?.telefone ?? "",
    motivo,
    observacao: `Detrator NPS ${NPS_DETRATOR_ORIGEM_LABELS[d.origem as NpsDetratorOrigem]} (nota ${d.score})${d.motivo ? `: ${d.motivo}` : ""}`.slice(0, 300),
    origem: "nps",
    origemId: chave,
    avisoOrigem: doCadastro
      ? "Nome e CPF vieram do cadastro do Protheus pelo telefone do detrator. Confira antes de emitir."
      : "Não achei um CPF único no Protheus pelo telefone deste detrator. Digite o CPF do cliente.",
  };
}

// CPF de CNPJ/estorno sem CPF não serve: o campo fica vazio pra ser digitado.
async function completar(p: PreenchimentoVoucher): Promise<PreenchimentoVoucher> {
  const cpf = somenteDigitos(p.clienteCpf ?? "");
  if (cpf.length !== 11) {
    return { ...p, clienteCpf: "", avisoOrigem: "Este caso não tem CPF de pessoa física registrado. Digite o CPF do cliente." };
  }
  const c = await buscarClientePorCpf(cpf);
  return { ...p, clienteCpf: cpf, clienteTelefone: c?.telefone ?? "", clienteNome: p.clienteNome || c?.nome || "" };
}
