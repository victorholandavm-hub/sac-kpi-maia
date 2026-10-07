import { getSupabaseAdmin } from "./supabaseAdmin";
import { photoPublicUrl } from "./localPhotoStorage";

// Fluxo de solicitação de estorno (loja -> financeiro) -- ver migration
// 0139_estorno_requests.sql. Separado da tabela `estornos` (estornos.ts),
// que é só o log histórico manual da aba /clientes.

export type EstornoRequestStatus = "pendente" | "concluido" | "recusado";
export type EstornoRequesterRole = "caixa" | "gerente";

export type EstornoAnexo = { path: string; url: string; uploadedBy: string | null; createdAt: string };

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
  autorizadoGerencia: boolean;
  anexosSolicitacao: EstornoAnexo[];
  status: EstornoRequestStatus;
  anexosComprovante: EstornoAnexo[];
  concluidoPor: string | null;
  concluidoEm: string | null;
  recusadoPor: string | null;
  recusadoEm: string | null;
  motivoRecusa: string | null;
  createdAt: string;
};

const COLUMNS =
  "id, store_id, stores(name), requester_role, requester_name, cliente_nome, cpf, codigo_cliente, nf_entrada, nf_devolucao, valor_reembolso, data_venda, forma_pagamento, motivo, produto, autorizado_por, autorizado_gerencia, anexo_solicitacao_path, status, anexo_comprovante_path, concluido_por, concluido_em, recusado_por, recusado_em, motivo_recusa, created_at";

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
  autorizado_gerencia: boolean;
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

function toEstornoRequest(row: Row, anexos: { solicitacao: EstornoAnexo[]; comprovante: EstornoAnexo[] }): EstornoRequest {
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
    autorizadoGerencia: row.autorizado_gerencia,
    anexosSolicitacao: anexos.solicitacao,
    status: row.status,
    anexosComprovante: anexos.comprovante,
    concluidoPor: row.concluido_por,
    concluidoEm: row.concluido_em,
    recusadoPor: row.recusado_por,
    recusadoEm: row.recusado_em,
    motivoRecusa: row.motivo_recusa,
    createdAt: row.created_at,
  };
}

// Busca os anexos de um lote de solicitações de uma vez (1 query, não N+1) --
// usado pelas 3 formas de ler estorno_requests abaixo.
async function attachAnexos(rows: Row[]): Promise<EstornoRequest[]> {
  if (rows.length === 0) return [];
  const admin = getSupabaseAdmin();
  const ids = rows.map((r) => r.id);
  const { data: anexos, error } = await admin
    .from("estorno_anexos")
    .select("estorno_id, kind, path, uploaded_by, created_at")
    .in("estorno_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const porEstorno = new Map<string, { solicitacao: EstornoAnexo[]; comprovante: EstornoAnexo[] }>();
  for (const a of anexos ?? []) {
    const entry = porEstorno.get(a.estorno_id) ?? { solicitacao: [], comprovante: [] };
    const item: EstornoAnexo = { path: a.path, url: photoPublicUrl(a.path), uploadedBy: a.uploaded_by, createdAt: a.created_at };
    entry[a.kind as "solicitacao" | "comprovante"].push(item);
    porEstorno.set(a.estorno_id, entry);
  }

  return rows.map((row) => toEstornoRequest(row, porEstorno.get(row.id) ?? { solicitacao: [], comprovante: [] }));
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
  return attachAnexos(data ?? []);
}

// Pro financeiro/admin -- todas as lojas, filtro opcional por status.
export async function listAllEstornoRequests(status?: EstornoRequestStatus): Promise<EstornoRequest[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("estorno_requests").select(COLUMNS).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(error.message);
  return attachAnexos(data ?? []);
}

export async function getEstornoRequestById(id: string): Promise<EstornoRequest | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("estorno_requests").select(COLUMNS).eq("id", id).maybeSingle().returns<Row>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [result] = await attachAnexos([data]);
  return result;
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
  autorizadoGerencia: boolean;
  anexoSolicitacaoPaths: string[];
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
    autorizado_gerencia: input.autorizadoGerencia,
    // 1º arquivo -- satisfaz a NOT NULL da coluna antiga. A lista completa
    // (pode ter mais de um, ver estorno_anexos) entra logo abaixo.
    anexo_solicitacao_path: input.anexoSolicitacaoPaths[0],
  });
  if (error) throw new Error(error.message);

  const { error: anexoError } = await admin
    .from("estorno_anexos")
    .insert(input.anexoSolicitacaoPaths.map((path) => ({ estorno_id: id, kind: "solicitacao" as const, path, uploaded_by: input.requesterName })));
  if (anexoError) throw new Error(anexoError.message);
}

// Upload do(s) comprovante(s) e conclusão são o mesmo passo pro financeiro
// (ver /api/financeiro/upload-comprovante) -- só pendente pode ser
// concluída. Chamar de novo numa solicitação já concluída ADICIONA mais
// comprovantes (pedido do Victor 07/10/2026: "seja possível adicionar mais
// de um comprovante"), não substitui os que já tinham sido anexados.
export async function marcarEstornoConcluido(id: string, financeiroName: string, comprovantePaths: string[]): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("estorno_requests").select("status, anexo_comprovante_path").eq("id", id).maybeSingle();
  if (!current) throw new Error("Solicitação não encontrada.");
  // Recusado é terminal -- não dá pra "concluir por cima". Pendente (1ª vez)
  // ou concluído (adicionar mais comprovante) são os dois casos válidos aqui.
  if (current.status === "recusado") throw new Error("Essa solicitação foi recusada -- não dá pra concluir.");

  const { error: anexoError } = await admin
    .from("estorno_anexos")
    .insert(comprovantePaths.map((path) => ({ estorno_id: id, kind: "comprovante" as const, path, uploaded_by: financeiroName })));
  if (anexoError) throw new Error(anexoError.message);

  const update: Record<string, unknown> = { status: "concluido", concluido_por: financeiroName, concluido_em: new Date().toISOString() };
  // Coluna antiga só recebe o 1º comprovante de verdade -- chamadas
  // seguintes (adicionando mais) não sobrescrevem ela.
  if (!current.anexo_comprovante_path) update.anexo_comprovante_path = comprovantePaths[0];

  const { error } = await admin.from("estorno_requests").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

// Desfaz a conclusão (comprovante errado, ou concluiu sem querer) -- volta
// pra pendente, limpando TODOS os comprovantes anexados e quem concluiu.
// Pedido do Victor 23/09/2026 (estendido 07/10/2026 pra múltiplos).
export async function desfazerConclusaoEstorno(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("estorno_requests").select("status").eq("id", id).maybeSingle();
  if (!current) throw new Error("Solicitação não encontrada.");
  if (current.status !== "concluido") throw new Error("Essa solicitação não está concluída.");

  const { error: delError } = await admin.from("estorno_anexos").delete().eq("estorno_id", id).eq("kind", "comprovante");
  if (delError) throw new Error(delError.message);

  const { error } = await admin
    .from("estorno_requests")
    .update({ status: "pendente", anexo_comprovante_path: null, concluido_por: null, concluido_em: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type EstornoRequestsSummary = { pendente: number; concluido: number; recusado: number; valorPendente: number };

// Resumo pro topo da fila do financeiro/admin -- mesmo espírito dos
// StatTile de contagem por status que já aparecem em Encomendas/Peças.
export async function getEstornoRequestsSummary(): Promise<EstornoRequestsSummary> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("estorno_requests").select("status, valor_reembolso");
  if (error) throw new Error(error.message);

  const summary: EstornoRequestsSummary = { pendente: 0, concluido: 0, recusado: 0, valorPendente: 0 };
  for (const row of data ?? []) {
    const status = row.status as EstornoRequestStatus;
    if (status === "pendente") {
      summary.pendente++;
      summary.valorPendente += Number(row.valor_reembolso);
    } else if (status === "concluido") {
      summary.concluido++;
    } else if (status === "recusado") {
      summary.recusado++;
    }
  }
  return summary;
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
