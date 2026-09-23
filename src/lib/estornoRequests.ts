import { getSupabaseAdmin } from "./supabaseAdmin";
import { photoPublicUrl } from "./localPhotoStorage";

// Fluxo de solicitação de estorno (loja -> financeiro) -- ver migration
// 0139_estorno_requests.sql. Separado da tabela `estornos` (estornos.ts),
// que é só o log histórico manual da aba /clientes.

export type EstornoRequestStatus = "pendente" | "concluido" | "recusado";
export type EstornoRequesterRole = "caixa" | "gerente";

export type EstornoRequest = {
  id: string;
  storeId: string;
  storeName: string;
  requesterRole: EstornoRequesterRole;
  requesterName: string;
  clienteNome: string;
  cpf: string | null;
  codigoCliente: string | null;
  nfEntrada: string | null;
  nfDevolucao: string | null;
  valorReembolso: number;
  dataVenda: string | null;
  formaPagamento: string | null;
  motivo: string | null;
  produto: string | null;
  autorizadoPor: string | null;
  anexoSolicitacaoUrl: string;
  status: EstornoRequestStatus;
  anexoComprovanteUrl: string | null;
  concluidoPor: string | null;
  concluidoEm: string | null;
  recusadoPor: string | null;
  recusadoEm: string | null;
  motivoRecusa: string | null;
  createdAt: string;
};

const COLUMNS =
  "id, store_id, stores(name), requester_role, requester_name, cliente_nome, cpf, codigo_cliente, nf_entrada, nf_devolucao, valor_reembolso, data_venda, forma_pagamento, motivo, produto, autorizado_por, anexo_solicitacao_path, status, anexo_comprovante_path, concluido_por, concluido_em, recusado_por, recusado_em, motivo_recusa, created_at";

type Row = {
  id: string;
  store_id: string;
  stores: { name: string } | null;
  requester_role: EstornoRequesterRole;
  requester_name: string;
  cliente_nome: string;
  cpf: string | null;
  codigo_cliente: string | null;
  nf_entrada: string | null;
  nf_devolucao: string | null;
  valor_reembolso: number;
  data_venda: string | null;
  forma_pagamento: string | null;
  motivo: string | null;
  produto: string | null;
  autorizado_por: string | null;
  anexo_solicitacao_path: string;
  status: EstornoRequestStatus;
  anexo_comprovante_path: string | null;
  concluido_por: string | null;
  concluido_em: string | null;
  recusado_por: string | null;
  recusado_em: string | null;
  motivo_recusa: string | null;
  created_at: string;
};

function toEstornoRequest(row: Row): EstornoRequest {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.stores?.name ?? "—",
    requesterRole: row.requester_role,
    requesterName: row.requester_name,
    clienteNome: row.cliente_nome,
    cpf: row.cpf,
    codigoCliente: row.codigo_cliente,
    nfEntrada: row.nf_entrada,
    nfDevolucao: row.nf_devolucao,
    valorReembolso: row.valor_reembolso,
    dataVenda: row.data_venda,
    formaPagamento: row.forma_pagamento,
    motivo: row.motivo,
    produto: row.produto,
    autorizadoPor: row.autorizado_por,
    anexoSolicitacaoUrl: photoPublicUrl(row.anexo_solicitacao_path),
    status: row.status,
    anexoComprovanteUrl: row.anexo_comprovante_path ? photoPublicUrl(row.anexo_comprovante_path) : null,
    concluidoPor: row.concluido_por,
    concluidoEm: row.concluido_em,
    recusadoPor: row.recusado_por,
    recusadoEm: row.recusado_em,
    motivoRecusa: row.motivo_recusa,
    createdAt: row.created_at,
  };
}

// Pro caixa/gerente -- só as solicitações das lojas dele.
export async function listEstornoRequestsForStores(storeIds: string[]): Promise<EstornoRequest[]> {
  if (storeIds.length === 0) return [];
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("estorno_requests")
    .select(COLUMNS)
    .in("store_id", storeIds)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEstornoRequest);
}

// Pro financeiro/admin -- todas as lojas, filtro opcional por status.
export async function listAllEstornoRequests(status?: EstornoRequestStatus): Promise<EstornoRequest[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("estorno_requests").select(COLUMNS).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEstornoRequest);
}

export async function getEstornoRequestById(id: string): Promise<EstornoRequest | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("estorno_requests").select(COLUMNS).eq("id", id).maybeSingle().returns<Row>();
  if (error) throw new Error(error.message);
  return data ? toEstornoRequest(data) : null;
}

export type NewEstornoRequestInput = {
  storeId: string;
  requesterRole: EstornoRequesterRole;
  requesterName: string;
  clienteNome: string;
  cpf: string | null;
  codigoCliente: string | null;
  nfEntrada: string | null;
  nfDevolucao: string | null;
  valorReembolso: number;
  dataVenda: string | null;
  formaPagamento: string | null;
  motivo: string | null;
  produto: string | null;
  autorizadoPor: string | null;
  anexoSolicitacaoPath: string;
};

// `id` é gerado antes (crypto.randomUUID(), ver estornos-actions.ts) --
// mesmo padrão de upload-antes-do-insert já usado em createSacRequest
// (servicePhotos.ts): o anexo sobe pra esse id ANTES da linha existir, e se
// o upload falhar, a linha nunca chega a ser criada.
export async function createEstornoRequest(id: string, input: NewEstornoRequestInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("estorno_requests").insert({
    id,
    store_id: input.storeId,
    requester_role: input.requesterRole,
    requester_name: input.requesterName,
    cliente_nome: input.clienteNome,
    cpf: input.cpf,
    codigo_cliente: input.codigoCliente,
    nf_entrada: input.nfEntrada,
    nf_devolucao: input.nfDevolucao,
    valor_reembolso: input.valorReembolso,
    data_venda: input.dataVenda,
    forma_pagamento: input.formaPagamento,
    motivo: input.motivo,
    produto: input.produto,
    autorizado_por: input.autorizadoPor,
    anexo_solicitacao_path: input.anexoSolicitacaoPath,
  });
  if (error) throw new Error(error.message);
}

// Upload do comprovante e conclusão são o mesmo passo pro financeiro (ver
// /api/financeiro/upload-comprovante) -- só pendente pode ser concluída.
export async function marcarEstornoConcluido(id: string, financeiroName: string, comprovantePath: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("estorno_requests").select("status").eq("id", id).maybeSingle();
  if (!current) throw new Error("Solicitação não encontrada.");
  if (current.status !== "pendente") throw new Error("Essa solicitação já foi processada.");

  const { error } = await admin
    .from("estorno_requests")
    .update({
      status: "concluido",
      anexo_comprovante_path: comprovantePath,
      concluido_por: financeiroName,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recusarEstornoRequest(id: string, financeiroName: string, motivo: string): Promise<void> {
  const trimmed = motivo.trim();
  if (!trimmed) throw new Error("Informe o motivo da recusa.");

  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("estorno_requests").select("status").eq("id", id).maybeSingle();
  if (!current) throw new Error("Solicitação não encontrada.");
  if (current.status !== "pendente") throw new Error("Essa solicitação já foi processada.");

  const { error } = await admin
    .from("estorno_requests")
    .update({
      status: "recusado",
      recusado_por: financeiroName,
      recusado_em: new Date().toISOString(),
      motivo_recusa: trimmed,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
